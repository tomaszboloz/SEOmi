import { afterEach, expect, it, vi } from 'vitest';
import { indexedDbWrite } from '../src/services/crawlPersistence/browser';
import { createCrawlRunFixture } from './fixtures/crawl';
import i18n from '../src/i18n';

const write = vi.hoisted(() => vi.fn());
vi.mock('../src/services/crawlPersistence/indexedDb', () => ({ indexedDbWriteOnce: write }));
vi.mock('../src/services/crawlPersistence/codec', () => ({ encodeCrawlRunsForStorage: async (runs: unknown) => runs }));
afterEach(() => { write.mockReset(); vi.unstubAllGlobals(); localStorage.clear(); });

it('clears both legacy mirrors only after dedicated storage accepts the rows', async () => {
  vi.stubGlobal('indexedDB', {});
  localStorage.setItem('seomi_project_p_crawl_runs', 'obsolete');
  localStorage.setItem('seomi_project_p_crawl_result', 'obsolete');
  write.mockResolvedValue(undefined);
  const rows = [createCrawlRunFixture()];
  expect(await indexedDbWrite('p', rows)).toEqual({ prunedRuns: 0 });
  expect(write).toHaveBeenCalledWith('p', rows, rows);
  expect(localStorage.getItem('seomi_project_p_crawl_runs')).toBeNull();
  expect(localStorage.getItem('seomi_project_p_crawl_result')).toBeNull();
});

it.each([0, 1, 2, 3, 4])('propagates non-quota errors at browser recovery attempt %i', async attempts => {
  for (let index = 0; index < attempts; index++) write.mockRejectedValueOnce('quota');
  const error = new Error('unavailable');
  write.mockRejectedValueOnce(error);
  await expect(indexedDbWrite('p', [createCrawlRunFixture()])).rejects.toBe(error);
  expect(write).toHaveBeenCalledTimes(attempts + 1);
});

it('propagates non-quota errors from a reduced history write', async () => {
  write.mockRejectedValueOnce('quota').mockRejectedValueOnce('unavailable');
  await expect(indexedDbWrite('p', [createCrawlRunFixture(), createCrawlRunFixture()]))
    .rejects.toBe('unavailable');
});

it('reports exhausted browser quota after all marked recovery attempts fail', async () => {
  write.mockRejectedValue('quota');
  await expect(indexedDbWrite('p', [createCrawlRunFixture()]))
    .rejects.toThrow(i18n.t('runtimeErrors.persistence.localQuota'));
  expect(write).toHaveBeenCalledTimes(5);
});

it('continues geometric reduction when a retained-history retry also exceeds quota', async () => {
  write.mockRejectedValueOnce('quota').mockRejectedValueOnce('quota').mockResolvedValueOnce(undefined);
  const rows = Array.from({ length: 4 }, (_, index) => createCrawlRunFixture({ id: String(index) }));
  expect(await indexedDbWrite('p', rows)).toEqual({ prunedRuns: 3 });
  expect(write.mock.calls[2][1]).toEqual([rows[0]]);
});
