import { beforeEach, describe, expect, it, vi } from 'vitest';
import { rulesFromQuarantine } from '@/services/deployArtifacts/fromBus';
import { editTask, filterTasks } from '@/services/optimizationTasks/edit';
import { appendDeltas, metricHistoryKey, readMetricHistory } from '@/services/optimizationTasks/metricHistory';
import { runTaskVerification } from '@/services/optimizationTasks/runVerification';
import { readTasks, writeTasks } from '@/services/optimizationTasks/storage';
import type { OptimizationTask } from '@/services/optimizationTasks/types';
import { busInputFromReports } from '@/services/recommendationBus/fromReports';
import { prepareBriefNavigation, semanticMapKey, takePendingBrief } from '@/services/executionCard/openBrief';
import { createCrawlPageFixture as page } from './fixtures/crawl';

vi.mock('@/services/siteFocus', () => ({ buildSiteFocusReport: () => ({ score: 70, unavailable: false }) }));
vi.mock('@/services/topicalAuthority', () => ({ buildAuthorityReport: () => ({ tas: 65 }) }));

const A = 'https://s.test/a';
const task = (patch: Partial<OptimizationTask> = {}): OptimizationTask => ({ id: 't1', kind: 'remove-410', module: 'sfs', status: 'implemented', url: A, baselineScore: 60, priority: 'high', createdAt: 'x', implementedAt: '2026-10-01T10:00:00Z', ...patch });

describe('bus input and rules', () => {
  it('uses TRS < 40 non-technical pages and cannibal groups', () => {
    const sfs = { pages: [{ url: 'a', trs: 10, type: 'blog' }, { url: 'b', trs: 90, type: 'blog' }, { url: 'c', trs: 5, type: 'technical' }, { url: 'd', trs: 1, type: 'blog', skipped: 'thin' }] };
    const tas = { cannibalization: [{ urls: ['x', 'y'], canonical: 'x' }] };
    expect(busInputFromReports(sfs as never, tas as never, { protectedUrls: ['p'], needsDataUrls: ['n'] })).toEqual({ removeUrls: ['a'], protectedUrls: ['p'], needsDataUrls: ['n'], cannibal: [{ urls: ['x', 'y'], canonical: 'x' }] });
    expect(busInputFromReports()).toEqual({ removeUrls: [], protectedUrls: [], needsDataUrls: [], cannibal: [] });
  });
  it('maps quarantine to 410 and 301 rules', () => {
    expect(rulesFromQuarantine([
      { url: 'https://s.test/r', reason: 'remove', quarantined: true, source: 'site-focus' },
      { url: 'https://s.test/m', reason: 'redirect', quarantined: true, target: 'https://s.test/c', source: 'topical-authority' },
      { url: 'https://s.test/n', reason: 'redirect', quarantined: true, source: 'topical-authority' },
    ])).toEqual([{ from: 'https://s.test/r', to: null, status: 410 }, { from: 'https://s.test/m', to: 'https://s.test/c', status: 301 }]);
  });
});

describe('task edit and filter', () => {
  it('edits owner, priority and date, ignoring invalid values', () => {
    let tasks = [task({ owner: 'x', dueDate: '2026-01-01' }), task({ id: 't2' })];
    tasks = editTask(tasks, 't1', { owner: '  Ann  ', priority: 'low', dueDate: '2026-02-03' });
    expect(tasks[0]).toMatchObject({ owner: 'Ann', priority: 'low', dueDate: '2026-02-03' });
    tasks = editTask(tasks, 't1', { dueDate: 'bad', priority: 'nope' as never });
    expect(tasks[0]).toMatchObject({ priority: 'low', dueDate: '2026-02-03' });
    tasks = editTask(tasks, 't1', { owner: ' ', dueDate: '' });
    expect(tasks[0].owner).toBeUndefined();
    expect(tasks[0].dueDate).toBeUndefined();
    expect(tasks[1].id).toBe('t2');
  });
  it('filters mine and overdue', () => {
    const tasks = [task({ owner: 'Ann', dueDate: '2026-01-01' }), task({ id: 'b', status: 'verified', dueDate: '2026-01-01' }), task({ id: 'c' })];
    expect(filterTasks(tasks, 'all', '', '2026-05-05')).toHaveLength(3);
    expect(filterTasks(tasks, 'mine', ' ann ', '2026-05-05')).toHaveLength(1);
    expect(filterTasks(tasks, 'mine', '', '2026-05-05')).toHaveLength(0);
    expect(filterTasks(tasks, 'overdue', '', '2026-05-05').map((x) => x.id)).toEqual(['t1']);
  });
});

describe('metric history and verification', () => {
  beforeEach(() => localStorage.clear());
  it('records only newly verified tasks with a delta', () => {
    const before = [task(), task({ id: 'n', baselineScore: null }), task({ id: 'p', status: 'planned' })];
    const after = [
      task({ status: 'verified', verifiedAt: 'v', verdict: { status: 'verified', code: 'gone-ok', params: {}, delta: 10, regression: false } }),
      task({ id: 'n', status: 'verified', verdict: { status: 'verified', code: 'gone-ok', params: {}, delta: null, regression: false } }),
      task({ id: 'p', status: 'planned' }), task({ id: 'z', status: 'verified' }),
    ];
    expect(appendDeltas('p', before, after)).toHaveLength(1);
    expect(appendDeltas('p', after, after)).toHaveLength(0);
    expect(readMetricHistory('p')[0]).toMatchObject({ taskId: 't1', delta: 10 });
    localStorage.setItem(metricHistoryKey('q'), '{}');
    expect(readMetricHistory('q')).toEqual([]);
  });
  it('verifies after a crawl and writes deltas', () => {
    const run = { startedAt: '2026-10-01T12:00:00Z', completedAt: '2026-10-01T12:01:00Z', result: { start_url: A, pages: [page({ url: A, final_url: A, http_status: 410 })] } } as never;
    expect(runTaskVerification('p', run)).toEqual([]);
    writeTasks('p', [task(), task({ id: 't2', module: 'tas', baselineScore: 60 }), task({ id: 't3', module: 'eetv' as never, baselineScore: 1 })]);
    runTaskVerification('p', run);
    expect(readTasks('p').map((x) => x.status)).toEqual(['verified', 'verified', 'verified']);
    expect(readMetricHistory('p').map((x) => x.delta)).toEqual([10, 5]);
  });
});

describe('brief navigation', () => {
  beforeEach(() => localStorage.clear());
  it('stores pending node once and forces plan view', () => {
    prepareBriefNavigation(null, 'n0');
    expect(takePendingBrief()).toBe('n0');
    expect(takePendingBrief()).toBeNull();
    localStorage.setItem(semanticMapKey('p', 'current'), JSON.stringify({ query: 'q' }));
    prepareBriefNavigation('p', 'n1');
    expect(JSON.parse(localStorage.getItem(semanticMapKey('p', 'current')) as string)).toEqual({ query: 'q', activeView: 'plan' });
    localStorage.setItem(semanticMapKey('p', 'current'), '[1]');
    prepareBriefNavigation('p', 'n2');
    expect(JSON.parse(localStorage.getItem(semanticMapKey('p', 'current')) as string)).toEqual({ activeView: 'plan' });
  });
});
