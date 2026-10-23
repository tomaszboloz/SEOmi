import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadStoredRuns, migrateLegacyCrawlRuns } from '@/services/crawlStore';
import { appendDeltas, metricHistoryKey, readMetricHistory } from '@/services/optimizationTasks/metricHistory';
import { editTask, filterTasks } from '@/services/optimizationTasks/edit';
import { writeTasks } from '@/services/optimizationTasks/storage';
import type { OptimizationTask } from '@/services/optimizationTasks/types';
import { createCrawlRunFixture } from './fixtures/crawl';

const native = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@/services/tauri', () => ({ invokeTauriCommand: native.invoke }));

afterEach(() => { native.invoke.mockReset(); vi.restoreAllMocks(); localStorage.clear(); });

it('shares one in-flight legacy migration between concurrent callers', async () => {
  const run = createCrawlRunFixture({ id: 'legacy-once' });
  localStorage.setItem('seomi_project_concurrent_crawl_runs', JSON.stringify([run]));
  let release!: (value: number) => void;
  native.invoke.mockImplementation(async (command: string) => {
    if (command === 'load_project_crawl_runs') return [run];
    if (command === 'store_import_legacy_runs') return new Promise<number>((resolve) => { release = resolve; });
    return [];
  });
  const first = migrateLegacyCrawlRuns('concurrent');
  const second = migrateLegacyCrawlRuns('concurrent');
  expect(first).toBe(second);
  await vi.waitFor(() => expect(release).toBeTypeOf('function'));
  release(1);
  expect(await first).toBe(1);
  expect(native.invoke.mock.calls.filter(([command]) => command === 'store_import_legacy_runs')).toHaveLength(1);
});

it('loads a complete SQLite snapshot only when every page count matches', async () => {
  const run = createCrawlRunFixture({ id: 'stored' });
  native.invoke.mockImplementation(async (command: string) => command === 'store_list_crawl_runs'
    ? [{ id: run.id, completedAt: run.completedAt, startUrl: run.startUrl, pageCount: run.result.pages.length }]
    : run);
  await expect(loadStoredRuns('sqlite')).resolves.toEqual([run]);
});

type Task = OptimizationTask;
const task = (patch: Partial<Task> = {}): Task => ({ id: 't', kind: 'remove-410', module: 'sfs', status: 'implemented',
  url: 'https://site.test/a', baselineScore: 10, priority: 'medium', createdAt: 'now', ...patch });

describe('optimization task persistence edges', () => {
  beforeEach(() => localStorage.clear());

  it('records failed verification deltas without inventing a timestamp', () => {
    const failed = task({ status: 'failed', verdict: { status: 'failed', code: 'wrong-status', params: { status: 200 }, delta: 0, regression: false } });
    expect(appendDeltas('tasks', [task()], [failed])).toEqual([{
      taskId: 't', module: 'sfs', url: 'https://site.test/a', delta: 0, status: 'failed', at: '',
    }]);
    expect(readMetricHistory('tasks')).toHaveLength(1);
  });

  it('returns safe storage failure and preserves task filtering semantics', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(writeTasks('quota', [task()])).toBe(false);
    const tasks = [task({ owner: 'Ann', dueDate: '2026-01-01' }), task({ id: 'v', status: 'verified', dueDate: '2026-01-01' })];
    expect(editTask(tasks, 'missing', { owner: 'Nobody' })).toEqual(tasks);
    expect(filterTasks(tasks, 'overdue', 'Ann', '2026-02-01')).toEqual([tasks[0]]);
  });

  it('ignores malformed metric history rows while retaining valid evidence', () => {
    localStorage.setItem(metricHistoryKey('malformed'), JSON.stringify([{ taskId: 'ok', delta: 1 }, { taskId: 4, delta: 2 }, null]));
    expect(readMetricHistory('malformed')).toEqual([{ taskId: 'ok', delta: 1 }]);
  });
});
