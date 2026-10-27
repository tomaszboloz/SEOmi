import { afterEach, expect, it, vi } from 'vitest';
import { loadCrawlRuns, saveCrawlRuns } from '../src/services/crawlPersistence';
import { listStoredRuns, loadStoredPages, loadStoredRun, migrateLegacyCrawlRuns } from '../src/services/crawlStore';
import { createCrawlRunFixture } from './fixtures/crawl';

const native = vi.hoisted(() => ({ invokeTauriCommand: vi.fn(), isTauriEnvironment: () => true }));
vi.mock('../src/services/tauri', () => native);
afterEach(() => { native.invokeTauriCommand.mockReset(); localStorage.clear(); });

const summary = (id: string, pageCount = 3) => ({ id, completedAt: '2026-01-01', startUrl: 'https://e.test/', pageCount });

it('saves the full replacement snapshot without truncation', async () => {
  const keep = createCrawlRunFixture({ id: 'keep' });
  native.invokeTauriCommand.mockImplementation(async (cmd: string) => (cmd === 'load_project_crawl_runs' || cmd === 'store_load_crawl_events' ? [] : undefined));
  localStorage.setItem('seomi_project_p_crawl_runs', '[]');
  expect(await saveCrawlRuns('p', [keep])).toEqual({ prunedRuns: 0 });
  expect(native.invokeTauriCommand).toHaveBeenCalledWith('store_replace_crawl_runs', { projectId: 'p', runs: [keep] });
  expect(localStorage.getItem('seomi_project_p_crawl_runs')).toBeNull();
});

it('reports pruned count above the fifty run cap', async () => {
  native.invokeTauriCommand.mockImplementation(async (cmd: string) => (cmd === 'load_project_crawl_runs' || cmd === 'store_load_crawl_events' ? [] : undefined));
  const rows = Array.from({ length: 52 }, (_, i) => createCrawlRunFixture({ id: `r${i}` }));
  expect(await saveCrawlRuns('p', rows)).toEqual({ prunedRuns: 2 });
  expect(native.invokeTauriCommand).toHaveBeenCalledWith('store_replace_crawl_runs', { projectId: 'p', runs: rows.slice(0, 50) });
});

it('migrates once with a backup, then loads from SQLite', async () => {
  const legacy = createCrawlRunFixture({ id: 'old' });
  const raw = JSON.stringify([legacy]);
  localStorage.setItem('seomi_project_m_crawl_runs', raw);
  native.invokeTauriCommand.mockImplementation(async (cmd: string) => {
    if (cmd === 'load_project_crawl_runs') return [legacy];
    if (cmd === 'store_import_legacy_runs') return 1;
    if (cmd === 'store_list_crawl_runs') return [summary('old', 0)];
    if (cmd === 'store_load_crawl_run') return legacy;
    if (cmd === 'store_load_crawl_events') return [];
    if (cmd === 'store_append_crawl_events') return 1;
    return undefined;
  });
  expect(await loadCrawlRuns('m')).toEqual([legacy]);
  expect(localStorage.getItem('seomi_project_m_crawl_runs_v1_backup')).toBe(raw);
  expect(native.invokeTauriCommand).toHaveBeenCalledWith('store_import_legacy_runs', { projectId: 'm', source: 'v1', runs: [legacy] });
  native.invokeTauriCommand.mockClear();
  expect(await migrateLegacyCrawlRuns('m')).toBe(0);
  expect(native.invokeTauriCommand).not.toHaveBeenCalled();
});

it('does not mark migration done when import fails, so it retries', async () => {
  native.invokeTauriCommand.mockImplementation(async (cmd: string) => {
    if (cmd === 'load_project_crawl_runs') return [createCrawlRunFixture({ id: 'a' })];
    if (cmd === 'store_import_legacy_runs') throw new Error('crash');
    return undefined;
  });
  await expect(migrateLegacyCrawlRuns('f')).rejects.toThrow('crash');
  expect(localStorage.getItem('seomi_store_v2_migrated_f')).toBeNull();
  native.invokeTauriCommand.mockImplementation(async (cmd: string) => (cmd === 'store_import_legacy_runs' ? 1 : []));
  expect(await migrateLegacyCrawlRuns('f')).toBe(0);
  expect(localStorage.getItem('seomi_store_v2_migrated_f')).toBe('1');
});

it('skips import for empty legacy sources', async () => {
  native.invokeTauriCommand.mockResolvedValue([]);
  expect(await migrateLegacyCrawlRuns('e')).toBe(0);
});

it('lazy readers return null, summaries and page windows', async () => {
  native.invokeTauriCommand.mockImplementation(async (cmd: string) => (cmd === 'store_list_crawl_runs' ? [summary('x')] : cmd === 'store_load_crawl_pages' ? [{ url: 'u' }] : null));
  expect(await loadStoredRun('p', 'nope')).toBeNull();
  expect(await listStoredRuns('p')).toEqual([summary('x')]);
  expect(await loadStoredPages('p', 'x', 0, 10)).toEqual([{ url: 'u' }]);
  expect(native.invokeTauriCommand).toHaveBeenLastCalledWith('store_load_crawl_pages', { projectId: 'p', runId: 'x', offset: 0, limit: 10 });
});
