import { afterEach, expect, it, vi } from 'vitest';
import { migrateLegacyCrawlRuns, saveStoredRuns, loadStoredRuns } from '@/services/crawlStore';
import { loadCrawlRuns } from '@/services/crawlPersistence';
import { createCrawlRunFixture } from './fixtures/crawl';
import { saveCrawlRuns } from '@/services/crawlPersistence';

const native = vi.hoisted(() => ({ invokeTauriCommand: vi.fn(), isTauriEnvironment: () => true }));
const web = vi.hoisted(() => ({ indexedDbRead: vi.fn().mockResolvedValue([]) }));
vi.mock('@/services/tauri', () => native);
vi.mock('@/services/crawlPersistence/indexedDb', () => web);
afterEach(() => { vi.restoreAllMocks(); native.invokeTauriCommand.mockReset(); web.indexedDbRead.mockReset().mockResolvedValue([]); localStorage.clear(); });

it('does not complete migration after a legacy filesystem read failure and retries it', async () => {
  native.invokeTauriCommand.mockRejectedValueOnce(new Error('disk unavailable'));
  await expect(migrateLegacyCrawlRuns('retry')).rejects.toThrow();
  expect(localStorage.getItem('seomi_store_v2_migrated_retry')).toBeNull();
  const run = createCrawlRunFixture();
  native.invokeTauriCommand.mockImplementation(async (cmd: string) => cmd === 'load_project_crawl_runs' ? [run] : 1);
  expect(await migrateLegacyCrawlRuns('retry')).toBe(1);
});

it('does not complete migration after an IndexedDB read failure', async () => {
  native.invokeTauriCommand.mockResolvedValue([]);
  web.indexedDbRead.mockRejectedValueOnce(new Error('database locked'));
  await expect(migrateLegacyCrawlRuns('web-error')).rejects.toThrow();
  expect(localStorage.getItem('seomi_store_v2_migrated_web-error')).toBeNull();
});

it('imports localStorage as well as IndexedDB, retaining the native version of duplicate ids', async () => {
  const file = createCrawlRunFixture({ id: 'same' });
  const webRun = createCrawlRunFixture({ id: 'web' });
  const local = createCrawlRunFixture({ id: 'local' });
  web.indexedDbRead.mockResolvedValue([webRun]);
  localStorage.setItem('seomi_project_union_crawl_runs', JSON.stringify([local, { ...file, startUrl: 'old' }]));
  native.invokeTauriCommand.mockImplementation(async (cmd: string) => cmd === 'load_project_crawl_runs' ? [file] : 3);
  expect(await migrateLegacyCrawlRuns('union')).toBe(3);
  expect(native.invokeTauriCommand).toHaveBeenCalledWith('store_import_legacy_runs', {
    projectId: 'union', source: 'v1', runs: [file, webRun, local],
  });
});

it('preserves a malformed legacy snapshot without marking it imported', async () => {
  const raw = JSON.stringify([createCrawlRunFixture(), { id: 'broken' }]);
  localStorage.setItem('seomi_project_invalid_crawl_runs', raw);
  native.invokeTauriCommand.mockResolvedValue([]);
  await expect(migrateLegacyCrawlRuns('invalid')).rejects.toThrow();
  expect(localStorage.getItem('seomi_project_invalid_crawl_runs')).toBe(raw);
  expect(localStorage.getItem('seomi_store_v2_migrated_invalid')).toBeNull();
  expect(native.invokeTauriCommand).not.toHaveBeenCalledWith('store_import_legacy_runs', expect.anything());
});

it('does not silently omit an unreadable SQLite run from the next saved history', async () => {
  native.invokeTauriCommand.mockImplementation(async (cmd: string) => cmd === 'store_list_crawl_runs'
    ? [{ id: 'broken', completedAt: '2026-01-01', startUrl: 'https://example.test/', pageCount: 2 }]
    : { id: 'broken' });
  await expect(loadStoredRuns('invalid-store')).rejects.toThrow();
});

it('replaces an entire project snapshot with one atomic native operation', async () => {
  const runs = [createCrawlRunFixture({ id: 'first' }), createCrawlRunFixture({ id: 'second' })];
  native.invokeTauriCommand.mockResolvedValue(undefined);
  await saveStoredRuns('atomic', runs);
  expect(native.invokeTauriCommand.mock.calls).toEqual([['store_replace_crawl_runs', { projectId: 'atomic', runs }]]);
});

it('blocks a replacement and legacy cleanup while migration cannot read the original history', async () => {
  const original = JSON.stringify([createCrawlRunFixture({ id: 'original' })]);
  localStorage.setItem('seomi_project_save-error_crawl_runs', original);
  native.invokeTauriCommand.mockImplementation(async (cmd: string) => {
    if (cmd === 'load_project_crawl_runs') throw new Error('disk unavailable');
  });
  await expect(saveCrawlRuns('save-error', [createCrawlRunFixture({ id: 'new' })])).rejects.toThrow();
  expect(native.invokeTauriCommand).not.toHaveBeenCalledWith('store_replace_crawl_runs', expect.anything());
  expect(localStorage.getItem('seomi_project_save-error_crawl_runs')).toBe(original);
});

it('keeps committed migration data readable when a later replacement fails', async () => {
  const legacy = createCrawlRunFixture({ id: 'legacy' });
  localStorage.setItem('seomi_project_atomic-failure_crawl_runs', JSON.stringify([legacy]));
  let replacementAttempts = 0;
  native.invokeTauriCommand.mockImplementation(async (cmd: string) => {
    if (cmd === 'load_project_crawl_runs') return [legacy];
    if (cmd === 'store_import_legacy_runs') return 1;
    if (cmd === 'store_replace_crawl_runs') {
      replacementAttempts += 1;
      throw new Error('replacement rejected');
    }
    if (cmd === 'store_list_crawl_runs') return [{ ...legacy, pageCount: legacy.result.pages.length }];
    if (cmd === 'store_load_crawl_run') return legacy;
    return null;
  });

  await expect(saveCrawlRuns('atomic-failure', [createCrawlRunFixture({ id: 'new' })]))
    .rejects.toThrow('replacement rejected');
  expect(replacementAttempts).toBe(1);
  expect(localStorage.getItem('seomi_store_v2_migrated_atomic-failure')).toBe('1');
  expect(await loadCrawlRuns('atomic-failure')).toEqual([legacy]);
  expect(native.invokeTauriCommand.mock.calls.filter(([cmd]) => cmd === 'load_project_crawl_runs')).toHaveLength(1);
});
