import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { loadCrawlRuns } from '@/services/crawlPersistence';
import { restoreProjectBackup, PROJECT_BACKUP_FORMAT } from '@/services/projectBackup';
import { createCrawlRunFixture } from './fixtures/crawl';
import type { CrawlRunRecord } from '@/types';

const native = vi.hoisted(() => ({ invokeTauriCommand: vi.fn(), isTauriEnvironment: () => true }));
vi.mock('@/services/tauri', () => native);

const project = { id: 'source', name: 'Observed', createdAt: '2026-10-23', lastOpenedAt: '2026-10-23' };
const backup = (runs: CrawlRunRecord[], localStorage: Record<string, string>) => ({
  format: PROJECT_BACKUP_FORMAT, exportedAt: '2026-10-23T00:00:00Z', project, localStorage, crawlRuns: runs, secretsExcluded: true as const,
});

const installSqlite = (initial: Record<string, CrawlRunRecord[]> = {}) => {
  const sqlite = new Map(Object.entries(initial).map(([id, runs]) => [id, structuredClone(runs)]));
  native.invokeTauriCommand.mockImplementation(async (command: string, args: { projectId: string; runId?: string; runs?: CrawlRunRecord[] }) => {
    if (command === 'load_project_crawl_runs') return structuredClone(sqlite.get(args.projectId) ?? []);
    if (command === 'store_import_legacy_runs') {
      sqlite.set(args.projectId, structuredClone(args.runs ?? [])); return args.runs?.length ?? 0;
    }
    if (command === 'store_replace_crawl_runs') { sqlite.set(args.projectId, structuredClone(args.runs ?? [])); return undefined; }
    if (command === 'store_list_crawl_runs') return (sqlite.get(args.projectId) ?? []).map(run => ({
      id: run.id, completedAt: run.completedAt, startUrl: run.startUrl, pageCount: run.result.pages.length,
    }));
    if (command === 'store_load_crawl_run') return (sqlite.get(args.projectId) ?? []).find(run => run.id === args.runId) ?? null;
    return undefined;
  });
  return sqlite;
};

beforeEach(() => { localStorage.clear(); native.invokeTauriCommand.mockReset(); });
afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

it('keeps the original legacy run readable when restore replacement fails after migration', async () => {
  const original = createCrawlRunFixture({ id: 'A' });
  const replacement = createCrawlRunFixture({ id: 'B' });
  const sqlite = installSqlite();
  localStorage.setItem('seomi_project_target_crawl_runs', JSON.stringify([original]));
  native.invokeTauriCommand.mockImplementation(async (command: string, args: { projectId: string; runId?: string; runs?: CrawlRunRecord[] }) => {
    if (command === 'load_project_crawl_runs') return [];
    if (command === 'store_import_legacy_runs') {
      sqlite.set(args.projectId, structuredClone(args.runs ?? [])); return args.runs?.length ?? 0;
    }
    if (command === 'store_replace_crawl_runs') throw new Error('sqlite replacement failed');
    if (command === 'store_list_crawl_runs') return (sqlite.get(args.projectId) ?? []).map(run => ({
      id: run.id, completedAt: run.completedAt, startUrl: run.startUrl, pageCount: run.result.pages.length,
    }));
    if (command === 'store_load_crawl_run') return (sqlite.get(args.projectId) ?? []).find(run => run.id === args.runId) ?? null;
    return undefined;
  });
  await expect(restoreProjectBackup(backup([replacement], { crawl_runs: JSON.stringify([replacement]) }), 'target'))
    .rejects.toThrow('sqlite replacement failed');
  expect(localStorage.getItem('seomi_project_target_crawl_runs')).toBe(JSON.stringify([original]));
  expect(await loadCrawlRuns('target')).toEqual([original]);
});

it('aborts before writing backup fields when target migration cannot read native history', async () => {
  installSqlite();
  localStorage.setItem('seomi_project_target_active_tab_v1', 'keep');
  const writes = vi.spyOn(Storage.prototype, 'setItem');
  native.invokeTauriCommand.mockRejectedValue(new Error('native history unavailable'));
  await expect(restoreProjectBackup(backup([], { active_tab_v1: 'replacement' }), 'target'))
    .rejects.toThrow('native history unavailable');
  expect(localStorage.getItem('seomi_project_target_active_tab_v1')).toBe('keep');
  expect(writes).not.toHaveBeenCalled();
});
