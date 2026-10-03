import { afterEach, expect, it, vi } from 'vitest';
import { saveCrawlRunsUnlocked } from '../src/services/crawlPersistence/native';
import { loadCrawlRuns } from '../src/services/crawlPersistence';
import { createCrawlRunFixture } from './fixtures/crawl';
import i18n from '../src/i18n';

const native = vi.hoisted(() => ({ invokeTauriCommand: vi.fn(), isTauriEnvironment: () => true }));
vi.mock('../src/services/tauri', () => native);
afterEach(() => { native.invokeTauriCommand.mockReset(); localStorage.clear(); });

it('bounds history to fifty newest rows and parses native load results', async () => {
  native.invokeTauriCommand.mockResolvedValue(undefined);
  const rows = Array.from({ length: 51 }, (_, index) => createCrawlRunFixture({ id: String(index) }));
  expect(await saveCrawlRunsUnlocked('p', rows)).toEqual({ prunedRuns: 0 });
  expect(native.invokeTauriCommand).toHaveBeenCalledWith('save_project_crawl_runs', {
    projectId: 'p', crawlRuns: rows.slice(0, 50),
  });
  native.invokeTauriCommand.mockResolvedValue([rows[0]]);
  expect(await loadCrawlRuns('p')).toEqual([rows[0]]);
  expect(native.invokeTauriCommand).toHaveBeenLastCalledWith('load_project_crawl_runs', { projectId: 'p' });
});

it.each([0, 1, 2, 3, 4])('propagates a non-quota failure at recovery attempt %i', async attempts => {
  for (let index = 0; index < attempts; index++) native.invokeTauriCommand.mockRejectedValueOnce('disk full');
  const error = new Error('permission denied');
  native.invokeTauriCommand.mockRejectedValueOnce(error);
  await expect(saveCrawlRunsUnlocked('p', [createCrawlRunFixture()])).rejects.toBe(error);
  expect(native.invokeTauriCommand).toHaveBeenCalledTimes(attempts + 1);
});

it('does not swallow a non-quota failure while reducing history', async () => {
  native.invokeTauriCommand.mockRejectedValueOnce('disk full').mockRejectedValueOnce('permission denied');
  await expect(saveCrawlRunsUnlocked('p', [createCrawlRunFixture(), createCrawlRunFixture()]))
    .rejects.toBe('permission denied');
});

it('continues geometric reduction when a retained-history retry also exceeds quota', async () => {
  native.invokeTauriCommand.mockRejectedValueOnce('disk full').mockRejectedValueOnce('disk full')
    .mockResolvedValueOnce(undefined);
  const rows = Array.from({ length: 4 }, (_, index) => createCrawlRunFixture({ id: String(index) }));
  expect(await saveCrawlRunsUnlocked('p', rows)).toEqual({ prunedRuns: 3 });
  expect(native.invokeTauriCommand.mock.calls[2][1].crawlRuns).toEqual([rows[0]]);
});

it('reports exhausted disk space after the final marked page-index attempt', async () => {
  native.invokeTauriCommand.mockRejectedValue('disk full');
  await expect(saveCrawlRunsUnlocked('p', [createCrawlRunFixture()]))
    .rejects.toThrow(i18n.t('runtimeErrors.persistence.diskQuota'));
  expect(native.invokeTauriCommand).toHaveBeenCalledTimes(5);
  expect(native.invokeTauriCommand.mock.calls[4][1].crawlRuns[0])
    .toMatchObject({ storage_compacted: true, result: { storage_pages_total: 0 } });
});

it('confirms page-index recovery only after a successful native write', async () => {
  for (let index = 0; index < 4; index++) native.invokeTauriCommand.mockRejectedValueOnce('disk full');
  native.invokeTauriCommand.mockResolvedValueOnce(undefined);
  expect(await saveCrawlRunsUnlocked('p', [createCrawlRunFixture()]))
    .toEqual({ prunedRuns: 0, compactedRuns: 1 });
});
