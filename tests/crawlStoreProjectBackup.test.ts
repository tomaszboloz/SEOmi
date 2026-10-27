import { afterEach, expect, it, vi } from 'vitest';
import { loadCrawlRuns, saveCrawlRuns } from '@/services/crawlPersistence';
import { createProjectBackup, parseProjectBackup, restoreProjectBackup, serializeProjectBackup } from '@/services/projectBackup';
import { createCrawlPageFixture, createCrawlResultFixture, createCrawlRunFixture } from './fixtures/crawl';
import type { CrawlRunRecord, SeoProject } from '@/types';

const native = vi.hoisted(() => ({ invokeTauriCommand: vi.fn(), isTauriEnvironment: () => true }));
vi.mock('@/services/tauri', () => native);
afterEach(() => { native.invokeTauriCommand.mockReset(); localStorage.clear(); });

const project: SeoProject = { id: 'backup-source', name: 'Large site', createdAt: '2026-10-23', lastOpenedAt: '2026-10-23' };

const store = () => {
  const data = new Map<string, CrawlRunRecord[]>();
  native.invokeTauriCommand.mockImplementation(async (cmd: string, args: { projectId: string; runId?: string; runs?: CrawlRunRecord[] }) => {
    const runs = data.get(args.projectId) ?? [];
    if (cmd === 'load_project_crawl_runs') return [];
    if (cmd === 'store_replace_crawl_runs') data.set(args.projectId, structuredClone(args.runs!));
    if (cmd === 'store_list_crawl_runs') return runs.map(run => ({ ...run, pageCount: run.result.pages.length }));
    if (cmd === 'store_load_crawl_run') return runs.find(run => run.id === args.runId) ?? null;
  });
  return data;
};

it('exports, parses and restores all ten thousand pages with their evidence into an isolated project', async () => {
  const data = store();
  const pages = Array.from({ length: 10_000 }, (_, index) => createCrawlPageFixture({
    url: `https://example.test/${index}`, links: [{ target_url: 'https://example.test/target', anchor_text: `Context ${index}`, is_internal: true }],
  }));
  const run = createCrawlRunFixture({ result: createCrawlResultFixture({ pages, pages_crawled: pages.length }) });
  await saveCrawlRuns(project.id, [run]);
  const backup = parseProjectBackup(serializeProjectBackup(await createProjectBackup(project)));
  expect(backup.crawlRuns[0].result.pages).toHaveLength(10_000);
  expect(await restoreProjectBackup(backup, 'backup-target')).toMatchObject({ crawlRuns: 1 });
  const restored = await loadCrawlRuns('backup-target');
  expect(restored[0].result.pages).toEqual(pages);
  expect(data.get(project.id)?.[0].result.pages).toEqual(pages);
}, 30_000);

it('restores Web Storage after a failed native replacement without changing the previous history', async () => {
  const data = store();
  const previous = createCrawlRunFixture({ id: 'previous' });
  data.set('backup-target', [previous]);
  localStorage.setItem('seomi_project_backup-target_note', 'previous note');
  const backup = { format: 'seomi-project-backup-v1' as const, project, exportedAt: '2026-10-23', secretsExcluded: true as const,
    localStorage: { note: 'replacement' }, crawlRuns: [createCrawlRunFixture()] };
  localStorage.setItem('seomi_store_v2_migrated_backup-target', '1');
  native.invokeTauriCommand.mockRejectedValueOnce(new Error('disk full'));
  await expect(restoreProjectBackup(backup, 'backup-target')).rejects.toThrow('disk full');
  expect(localStorage.getItem('seomi_project_backup-target_note')).toBe('previous note');
  expect(data.get('backup-target')).toEqual([previous]);
});
