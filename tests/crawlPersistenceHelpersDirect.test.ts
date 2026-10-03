import { afterEach, expect, it, vi } from 'vitest';
import { clearLegacyCrawlResult, clearLegacyCrawlStorage } from '../src/services/crawlPersistence/legacy';
import { withCrawlWriteLock } from '../src/services/crawlPersistence/writeLock';
import { crawlQuotaRetryCounts, isStorageQuotaError } from '../src/services/crawlPersistence/quota';
import { usesDedicatedCrawlStorage } from '../src/services/crawlPersistence';

afterEach(() => { localStorage.clear(); vi.unstubAllGlobals(); });

it('removes only known obsolete keys for the requested project', () => {
  for (const key of ['p_crawl_result', 'p_crawl_runs', 'p_preferences', 'q_crawl_runs']) {
    localStorage.setItem(`seomi_project_${key}`, 'kept');
  }
  clearLegacyCrawlResult('p');
  expect(localStorage.getItem('seomi_project_p_crawl_result')).toBeNull();
  expect(localStorage.getItem('seomi_project_p_crawl_runs')).toBe('kept');
  clearLegacyCrawlStorage('p');
  expect(localStorage.getItem('seomi_project_p_crawl_runs')).toBeNull();
  expect(localStorage.getItem('seomi_project_p_preferences')).toBe('kept');
  expect(localStorage.getItem('seomi_project_q_crawl_runs')).toBe('kept');
});

it('recovers a rejected project queue and lets another project proceed independently', async () => {
  let rejectFirst!: (error: Error) => void;
  const first = withCrawlWriteLock('p', () => new Promise<void>((_, reject) => { rejectFirst = reject; }));
  const rejected = expect(first).rejects.toThrow('failed');
  await Promise.resolve();
  const next = vi.fn(() => Promise.resolve('newest'));
  const second = withCrawlWriteLock('p', next);
  expect(await withCrawlWriteLock('q', () => Promise.resolve('other'))).toBe('other');
  expect(next).not.toHaveBeenCalled();
  rejectFirst(new Error('failed'));
  await rejected;
  expect(await second).toBe('newest');
  expect(await withCrawlWriteLock('p', () => Promise.resolve('after-cleanup'))).toBe('after-cleanup');
});

it.each([null, false, 4, {}, { message: 'network' }])('rejects non-quota error %j', value => {
  expect(isStorageQuotaError(value)).toBe(false);
});

it.each([{ code: 22 }, { code: 1014 }, { name: 'QuotaExceededError' }, 'no space left'])(
  'recognizes quota error %j', value => { expect(isStorageQuotaError(value)).toBe(true); });

it('retains strictly decreasing newest-run counts', () => {
  expect(crawlQuotaRetryCounts(8)).toEqual([4, 2, 1]);
  expect(crawlQuotaRetryCounts(1)).toEqual([]);
});

it('cleans a rejected final write before a later independent operation', async () => {
  await expect(withCrawlWriteLock('failed-final', () => Promise.reject(new Error('last failure'))))
    .rejects.toThrow('last failure');
  expect(await withCrawlWriteLock('failed-final', () => Promise.resolve('recovered'))).toBe('recovered');
});

it('reports dedicated browser storage only when IndexedDB is available', () => {
  vi.stubGlobal('indexedDB', undefined);
  expect(usesDedicatedCrawlStorage()).toBe(false);
  vi.stubGlobal('indexedDB', {});
  expect(usesDedicatedCrawlStorage()).toBe(true);
});
