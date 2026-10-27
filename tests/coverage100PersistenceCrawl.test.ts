import { afterEach, expect, it, vi } from 'vitest';
import { loadCrawlRuns, saveCrawlRuns, usesDedicatedCrawlStorage } from '@/services/crawlPersistence';
import { indexedDbRead, indexedDbWriteOnce } from '@/services/crawlPersistence/indexedDb';
import { encodeCrawlRunsForStorage } from '@/services/crawlPersistence/codec';
import { createCrawlRunFixture } from './fixtures/crawl';

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

it('round-trips a compressed browser fallback payload as base64', async () => {
  vi.stubGlobal('indexedDB', undefined);
  const run = createCrawlRunFixture({ id: 'compressed' });
  const encoded = await encodeCrawlRunsForStorage([run]);
  await indexedDbWriteOnce('compressed-project', [run], encoded);
  const persisted = JSON.parse(localStorage.getItem('seomi_project_compressed-project_crawl_runs') as string) as unknown;
  if ('format' in encoded) expect(persisted).toMatchObject({ format: encoded.format, bytes: expect.any(String) });
  else expect(persisted).toEqual([run]);
  await expect(indexedDbRead('compressed-project')).resolves.toEqual([run]);
});

it('keeps the browser fallback readable when compression is unavailable', async () => {
  vi.stubGlobal('indexedDB', undefined);
  vi.stubGlobal('CompressionStream', undefined);
  const run = createCrawlRunFixture({ id: 'raw' });
  await indexedDbWriteOnce('raw-project', [run]);
  expect(await loadCrawlRuns('raw-project')).toEqual([run]);
});

it('distinguishes malformed strict history from an absent history', async () => {
  vi.stubGlobal('indexedDB', undefined);
  expect(await indexedDbRead('missing', true)).toEqual([]);
  localStorage.setItem('seomi_project_bad_crawl_runs', '{broken');
  await expect(indexedDbRead('bad', true)).rejects.toThrow();
});

it('reports which browser persistence backend is available', () => {
  vi.stubGlobal('indexedDB', undefined);
  expect(usesDedicatedCrawlStorage()).toBe(false);
  vi.stubGlobal('indexedDB', {});
  expect(usesDedicatedCrawlStorage()).toBe(true);
});

it('serializes an ordinary browser save and returns no pruned runs', async () => {
  vi.stubGlobal('indexedDB', undefined);
  const run = createCrawlRunFixture({ id: 'saved' });
  expect(await saveCrawlRuns('saved-project', [run])).toEqual({ prunedRuns: 0 });
  expect(await loadCrawlRuns('saved-project')).toEqual([run]);
});
