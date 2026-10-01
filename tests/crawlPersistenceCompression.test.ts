import { createCrawlRunFixture, createCrawlResultFixture, createCrawlPageFixture } from './fixtures/crawl';
// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { decodeCrawlRunsFromStorage, encodeCrawlRunsForStorage, saveCrawlRuns } from '../src/services/crawlPersistence';

const localStorageValues = new Map<string, string>();
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
  it('round-trips and substantially reduces repetitive crawl snapshots', async () => {
    const runs = [{ ...createCrawlRunFixture(),
      id: 'run-1',
      result: { ...createCrawlResultFixture(),  pages: Array.from({ length: 500 }, (_, index) => ({ ...createCrawlPageFixture(),
        url: `https://example.test/page-${index}`,
        title: 'Repeated SEO page title',
        links: Array.from({ length: 20 }, () => ({ is_internal: true, target_url: 'https://example.test/target',  anchor_text: 'Repeated navigation link', rel: 'internal' })),
      })),
      },
    }] as never;

    const stored = await encodeCrawlRunsForStorage(runs);

    expect('format' in stored).toBe(true);
    if (!('format' in stored)) throw new Error('CompressionStream should be available in the Node test runtime.');
    expect(stored.bytes.byteLength).toBeLessThan(new TextEncoder().encode(JSON.stringify(runs)).byteLength / 5);
    expect(await decodeCrawlRunsFromStorage(stored)).toEqual(runs);
  });

  it('retries a large history when quota is hit during compression', async () => {
    const NativeCompressionStream = globalThis.CompressionStream;
    let compressionCalls = 0;
    class QuotaOnceCompressionStream extends NativeCompressionStream {
      constructor(format: CompressionFormat) {
        compressionCalls += 1;
        if (compressionCalls === 1) throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
        super(format);
      }
    }
    vi.stubGlobal('CompressionStream', QuotaOnceCompressionStream);
    localStorage.clear();

    const runs = Array.from({ length: 3 }, (_, index) => ({ ...createCrawlRunFixture(),  id: `run-${index}` })) as never;
    const result = await saveCrawlRuns('quota-project', runs);

    expect(result).toEqual({ prunedRuns: 2 });
    expect(compressionCalls).toBe(2);
    expect(await decodeCrawlRunsFromStorage(JSON.parse(localStorage.getItem('seomi_project_quota-project_crawl_runs') || '[]'))).toEqual([{ ...createCrawlRunFixture(),  id: 'run-0' }]);
  });

  it('prunes the localStorage fallback when IndexedDB is unavailable and quota is hit', async () => {
    localStorageQuotaFailures = 1;
    localStorage.clear();

    const runs = Array.from({ length: 3 }, (_, index) => ({ ...createCrawlRunFixture(),  id: `fallback-${index}` })) as never;
    const result = await saveCrawlRuns('fallback-quota-project', runs);

    expect(result).toEqual({ prunedRuns: 2 });
    expect(await decodeCrawlRunsFromStorage(JSON.parse(localStorage.getItem('seomi_project_fallback-quota-project_crawl_runs') || '[]'))).toEqual([{ ...createCrawlRunFixture(),  id: 'fallback-0' }]);
  });

  it('clears obsolete legacy result copies before retrying a quota recovery', async () => {
    localStorage.setItem('seomi_project_legacy-cleanup_crawl_result', JSON.stringify({ ...createCrawlResultFixture(),  pages: 500 }));
    localStorage.setItem('seomi_project_legacy-cleanup_crawl_runs', JSON.stringify([{ ...createCrawlRunFixture(),  id: 'legacy' }]));
    localStorageQuotaFailures = 1;

    const result = await saveCrawlRuns('legacy-cleanup', [{ ...createCrawlRunFixture(),  id: 'newest' }, { ...createCrawlRunFixture(),  id: 'older' }] as never);

    expect(result).toEqual({ prunedRuns: 1 });
    expect(localStorage.getItem('seomi_project_legacy-cleanup_crawl_result')).toBeNull();
    expect(await decodeCrawlRunsFromStorage(JSON.parse(localStorage.getItem('seomi_project_legacy-cleanup_crawl_runs') || '[]'))).toEqual([{ ...createCrawlRunFixture(),  id: 'newest' }]);
  });

  it('removes an obsolete result mirror on a successful dedicated history save', async () => {
    localStorage.setItem('seomi_project_success-cleanup_crawl_result', JSON.stringify({ ...createCrawlResultFixture(),  pages: 500 }));

    const result = await saveCrawlRuns('success-cleanup', [{ ...createCrawlRunFixture(),  id: 'newest' }] as never);

    expect(result).toEqual({ prunedRuns: 0 });
    expect(localStorage.getItem('seomi_project_success-cleanup_crawl_result')).toBeNull();
    expect(await decodeCrawlRunsFromStorage(JSON.parse(localStorage.getItem('seomi_project_success-cleanup_crawl_runs') || '[]'))).toEqual([{ ...createCrawlRunFixture(),  id: 'newest' }]);
  });

  it('falls back to a minimal snapshot when one run repeatedly exceeds quota', async () => {
    localStorageQuotaFailures = 3;
    localStorage.clear();

    const runs = [{ ...createCrawlRunFixture(),
      id: 'minimal-run',
      result: { ...createCrawlResultFixture(),
        pages: Array.from({ length: 8 }, (_, index) => ({ ...createCrawlPageFixture(),
          url: `https://example.com/${index}`,
            links: Array.from({ length: 20 }, () => ({ is_internal: true, target_url: 'https://example.com/target', anchor_text: 'link' })),
          images: Array.from({ length: 20 }, () => ({ src: 'https://example.test/image.png', lazy_loaded: false,  url: 'https://example.com/image.png', alt: 'image' })),
          issues: Array.from({ length: 20 }, () => ({ severity: 'Warning', code: 'issue', message: 'issue' })),
          semantic_terms: Array.from({ length: 20 }, (_, term) => `term-${term}`),
        })),
        resources: Array.from({ length: 20 }, () => ({ source_urls: [], resource_type: 'script',  url: 'https://example.com/resource.js' })),
        sitemap_urls: Array.from({ length: 20 }, (_, index) => `https://example.com/${index}`),
      },
    }] as never;

    const result = await saveCrawlRuns('minimal-quota-project', runs);

    expect(result).toEqual({ prunedRuns: 0, compactedRuns: 1 });
    const stored = JSON.parse(localStorage.getItem('seomi_project_minimal-quota-project_crawl_runs') || 'null');
    expect(await decodeCrawlRunsFromStorage(stored)).toHaveLength(1);
    expect((await decodeCrawlRunsFromStorage(stored))[0]).toMatchObject({ id: 'minimal-run', storage_compacted: true });
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

  afterEach(() => {
    localStorage.clear();
    localStorageQuotaFailures = 0;
    vi.unstubAllGlobals();
  });
});
