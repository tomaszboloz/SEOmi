import { afterEach, expect, it, vi } from 'vitest';
import { listStoredRuns, loadStoredRun, loadStoredRuns, saveStoredRuns, migrateLegacyCrawlRuns } from '@/services/crawlStore';
import { decodeCrawlRunsFromStorage, encodeCrawlRunsForStorage } from '@/services/crawlPersistence/codec';
import { createCrawlRunFixture } from './fixtures/crawl';

const native = vi.hoisted(() => ({ invokeTauriCommand: vi.fn() }));
vi.mock('@/services/tauri', () => native);
afterEach(() => { vi.restoreAllMocks(); native.invokeTauriCommand.mockReset(); localStorage.clear(); vi.unstubAllGlobals(); });

it.each([null, [{}], [{ id: 'x', completedAt: 'now', startUrl: 'url', pageCount: -1 }],
  [{ id: 'x', completedAt: 'now', startUrl: 'url', pageCount: '10' }]].map(rows => ({ rows })))(
  'rejects invalid stored summaries: $rows', async ({ rows }) => {
  native.invokeTauriCommand.mockResolvedValue(rows);
  await expect(listStoredRuns('p')).rejects.toThrow();
});

it('rejects duplicate summary ids and a loaded run belonging to a different id', async () => {
  const summary = { id: 'x', completedAt: 'now', startUrl: 'url', pageCount: 0 };
  native.invokeTauriCommand.mockResolvedValue([summary, summary]);
  await expect(listStoredRuns('p')).rejects.toThrow();
  native.invokeTauriCommand.mockResolvedValue(createCrawlRunFixture({ id: 'other' }));
  await expect(loadStoredRun('p', 'x')).rejects.toThrow();
});

it.each([null, createCrawlRunFixture()])('rejects missing or incomplete page data: %j', async raw => {
  native.invokeTauriCommand.mockImplementation(async (cmd: string) => cmd === 'store_list_crawl_runs'
    ? [{ id: 'fixture-run', completedAt: 'now', startUrl: 'url', pageCount: 5 }] : raw);
  await expect(loadStoredRuns('p')).rejects.toThrow();
});

it.each([[createCrawlRunFixture({ id: '' })], [createCrawlRunFixture(), createCrawlRunFixture()], [{ id: 'bad' }]].map(runs => ({ runs })))(
  'rejects invalid snapshots before invoking a destructive replacement: $runs', async ({ runs }) => {
    await expect(saveStoredRuns('p', runs as never)).rejects.toThrow();
    expect(native.invokeTauriCommand).not.toHaveBeenCalled();
  });

it('retains the legacy slot and leaves migration pending if the backup cannot be written', async () => {
  const raw = JSON.stringify([createCrawlRunFixture()]);
  localStorage.setItem('seomi_project_backup-fails_crawl_runs', raw);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('quota', 'QuotaExceededError'); });
  await expect(migrateLegacyCrawlRuns('backup-fails')).rejects.toThrow();
  expect(localStorage.getItem('seomi_project_backup-fails_crawl_runs')).toBe(raw);
  expect(localStorage.getItem('seomi_store_v2_migrated_backup-fails')).toBeNull();
  expect(native.invokeTauriCommand).not.toHaveBeenCalled();
});

it.each([null, {}, { format: 'unknown', bytes: 'bad' }, { format: 'seomi-crawl-gzip-json-v1', bytes: '!' },
  { format: 'seomi-crawl-gzip-json-v1', bytes: 2 }, [createCrawlRunFixture(), { id: 'bad' }]].map(raw => ({ raw })))(
  'strict decoding refuses unreadable history: $raw', async ({ raw }) => {
    await expect(decodeCrawlRunsFromStorage(raw, true)).rejects.toThrow();
  });

it('strict decoding keeps compressed valid runs and treats an absent IndexedDB record as empty', async () => {
  const runs = [createCrawlRunFixture()];
  expect(await decodeCrawlRunsFromStorage(await encodeCrawlRunsForStorage(runs), true)).toEqual(runs);
  expect(await decodeCrawlRunsFromStorage(undefined, true)).toEqual([]);
});

it('does not mark unsupported compressed history as migrated', async () => {
  vi.stubGlobal('DecompressionStream', undefined);
  localStorage.setItem('seomi_project_no-codec_crawl_runs', JSON.stringify({ format: 'seomi-crawl-gzip-json-v1', bytes: 'AA==' }));
  native.invokeTauriCommand.mockResolvedValue([]);
  await expect(migrateLegacyCrawlRuns('no-codec')).rejects.toThrow();
  expect(localStorage.getItem('seomi_store_v2_migrated_no-codec')).toBeNull();
});
