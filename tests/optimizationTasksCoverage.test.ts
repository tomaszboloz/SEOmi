import { beforeEach, describe, expect, it } from 'vitest';
import type { CrawlRunRecord } from '@/types';
import { editTask, filterTasks } from '@/services/optimizationTasks/edit';
import { appendDeltas, readMetricHistory, metricHistoryKey, MAX_METRIC_HISTORY } from '@/services/optimizationTasks/metricHistory';
import { runTaskVerification } from '@/services/optimizationTasks/runVerification';
import { writeTasks } from '@/services/optimizationTasks/storage';
import { verifyTask } from '@/services/optimizationTasks/verify';
import type { OptimizationTask } from '@/services/optimizationTasks/types';
import { createCrawlPageFixture as page } from './fixtures/crawl';

const U = 'https://site.test/p1';
const task = (id: string, patch: Partial<OptimizationTask> = {}): OptimizationTask => ({
  id, kind: 'remove-noindex', module: 'sfs', status: 'implemented', url: U,
  baselineScore: 50, priority: 'medium', createdAt: '2026-10-24T00:00:00Z',
  implementedAt: '2026-10-24T01:00:00Z', ...patch,
});

describe('optimizationTasks edit and filter coverage', () => {
  it('handles editTask branches: owner, priority, dueDate and unmatched id', () => {
    const t = task('t1', { owner: 'Alice', dueDate: '2026-10-20' });
    const tasks = [t, task('t2')];
    expect(editTask(tasks, 't1', { owner: '  Bob  ' })[0].owner).toBe('Bob');
    expect(editTask(tasks, 't1', { owner: '   ' })[0].owner).toBeUndefined();
    expect(editTask(tasks, 't1', { priority: 'high' })[0].priority).toBe('high');
    expect(editTask(tasks, 't1', { priority: 'invalid' as never })[0].priority).toBe('medium');
    expect(editTask(tasks, 't1', { dueDate: '' })[0].dueDate).toBeUndefined();
    expect(editTask(tasks, 't1', { dueDate: '2026-11-01' })[0].dueDate).toBe('2026-11-01');
    expect(editTask(tasks, 't1', { dueDate: 'not-a-date' })[0].dueDate).toBe('2026-10-20');
  });

  it('handles filterTasks branches: mine, overdue and all', () => {
    const tMine = task('t1', { owner: 'Alice' });
    const tOther = task('t2', { owner: 'Bob' });
    const tNoOwner = task('t3', { owner: undefined });
    const tOverduePlanned = task('t4', { dueDate: '2026-10-01', status: 'planned' });
    const tOverdueImpl = task('t5', { dueDate: '2026-10-01', status: 'implemented' });
    const tOverdueDone = task('t6', { dueDate: '2026-10-01', status: 'verified' });
    const tFuture = task('t7', { dueDate: '2026-12-01', status: 'planned' });
    const all = [tMine, tOther, tNoOwner, tOverduePlanned, tOverdueImpl, tOverdueDone, tFuture];

    expect(filterTasks(all, 'mine', 'alice', '2026-10-24')).toEqual([tMine]);
    expect(filterTasks(all, 'mine', '   ', '2026-10-24')).toEqual([]);
    expect(filterTasks(all, 'overdue', 'alice', '2026-10-24')).toEqual([tOverduePlanned, tOverdueImpl]);
    expect(filterTasks(all, 'all', 'alice', '2026-10-24')).toEqual(all);
  });
});

describe('optimizationTasks metricHistory and runVerification coverage', () => {
  beforeEach(() => localStorage.clear());

  it('handles readMetricHistory validation and filtering', () => {
    localStorage.setItem(metricHistoryKey('m1'), JSON.stringify('not-array'));
    expect(readMetricHistory('m1')).toEqual([]);

    const rows = [{ taskId: 't1', delta: 5 }, null, 'str', { taskId: 123, delta: 5 }, { taskId: 't2' }];
    localStorage.setItem(metricHistoryKey('m2'), JSON.stringify(rows));
    expect(readMetricHistory('m2')).toEqual([{ taskId: 't1', delta: 5 }]);
  });

  it('handles appendDeltas empty rows and history capping', () => {
    expect(appendDeltas('m3', [], [])).toEqual([]);

    const before = [task('t1')];
    const after = [{ ...before[0], status: 'verified' as const, verdict: { status: 'verified' as const, code: 'index-ok' as const, params: {}, delta: 2, regression: false } }];
    const existing = Array.from({ length: MAX_METRIC_HISTORY + 5 }, (_, i) => ({ taskId: `old-${i}`, module: 'sfs' as const, url: U, delta: 1, status: 'verified' as const, at: '' }));
    localStorage.setItem(metricHistoryKey('m4'), JSON.stringify(existing));
    const result = appendDeltas('m4', before, after);
    expect(result).toHaveLength(1);
    expect(readMetricHistory('m4')).toHaveLength(MAX_METRIC_HISTORY);
  });

  it('runTaskVerification early return when no tasks implemented and cached EETV', () => {
    writeTasks('no-impl', [task('p1', { status: 'planned' }), task('p2', { status: 'verified' })]);
    expect(runTaskVerification('no-impl', {} as CrawlRunRecord)).toHaveLength(2);

    writeTasks('eetv-cache', [
      task('e1', { module: 'eetv', kind: 'remove-noindex', baselineScore: 10 }),
      task('e2', { module: 'eetv', kind: 'remove-noindex', baselineScore: 20 }),
    ]);
    const run = { startedAt: '2026-10-24T05:00:00Z', result: { start_url: U, pages: [page({ url: U, final_url: U, http_status: 200, indexability_status: 'Eligible' })] } } as CrawlRunRecord;
    const verified = runTaskVerification('eetv-cache', run);
    expect(verified[0].status).toBe('verified');
    expect(verified[1].status).toBe('verified');
  });

  it('verifyTask fallback branches: empty targetUrl and absent indexability status', () => {
    const tLink = task('tl', { kind: 'add-link', targetUrl: undefined });
    expect(verifyTask(tLink, [page({ url: U, final_url: U, links: [] })], null)).toMatchObject({ status: 'failed', code: 'link-missing' });
    const pWithLink = page({ url: U, final_url: U, links: [{ target_url: 'https://site.test/other', anchor_text: 'x', is_internal: true }] });
    expect(verifyTask(tLink, [pWithLink], null)).toMatchObject({ status: 'failed', code: 'link-missing' });

    const tNoindex = task('tni', { kind: 'remove-noindex' });
    const pNoStatus = page({ url: U, final_url: U, http_status: 200, indexability_status: undefined, robots_decision: null, indexability_verdict: null });
    expect(verifyTask(tNoindex, [pNoStatus], null)).toBeNull();
  });

  it('eetv regression on all-HTTP0 crawl: returns honest null delta and zero metricHistory points', () => {
    writeTasks('eetv-http0', [task('e-fail', { module: 'eetv', kind: 'remove-410', baselineScore: 20 })]);
    const run = { startedAt: '2026-10-24T05:00:00Z', result: { start_url: U, duration_ms: 1000, pages: [page({ url: U, final_url: U, http_status: 0 })] } } as CrawlRunRecord;
    const verified = runTaskVerification('eetv-http0', run);
    expect(verified[0].status).toBe('implemented');
    expect(verified[0].verdict).toBeUndefined();
    expect(readMetricHistory('eetv-http0')).toHaveLength(0);
  });

  it('eetv mixed crawl: measures real 200 trust score while recording valid deltas', () => {
    const u2 = 'https://site.test/p2';
    const u3 = 'https://site.test/p3';
    writeTasks('eetv-mixed', [
      task('t-fail', { url: U, module: 'eetv', kind: 'remove-410', baselineScore: 20 }),
      task('t-ok', { url: u2, module: 'eetv', kind: 'remove-noindex', baselineScore: 20 }),
      task('t-gone', { url: u3, module: 'eetv', kind: 'remove-410', baselineScore: 20 }),
    ]);
    const run = {
      startedAt: '2026-10-24T05:00:00Z',
      result: {
        start_url: U, duration_ms: 1000,
        pages: [
          page({ url: U, final_url: U, http_status: 0 }),
          page({ url: u2, final_url: u2, http_status: 200, indexability_status: 'Eligible' }),
          page({ url: u3, final_url: u3, http_status: 410 }),
        ],
      },
    } as CrawlRunRecord;
    const verified = runTaskVerification('eetv-mixed', run);
    expect(verified[0].status).toBe('implemented');
    expect(verified[1].status).toBe('verified');
    expect(typeof verified[1].verdict?.delta).toBe('number');
    expect(verified[2].status).toBe('verified');
    expect(verified[2].verdict?.code).toBe('gone-ok');
    expect(readMetricHistory('eetv-mixed')).toHaveLength(2);
  });

  it('sprs returns honest null when task page is in graph but excluded from sprs report', () => {
    const u2 = 'https://site.test/p2';
    writeTasks('sprs-ineligible', [task('s-ineligible', { url: U, module: 'sprs', kind: 'remove-410', baselineScore: 30 })]);
    const pIneligible = page({ url: U, final_url: U, http_status: 200, meta_robots: 'noindex', semantic_terms: ['seo'] });
    const pEligible = page({ url: u2, final_url: u2, http_status: 200, semantic_terms: ['seo', 'audit'], links: [{ target_url: U, anchor_text: 'p1', is_internal: true }] });
    const run = { startedAt: '2026-10-24T05:00:00Z', result: { start_url: u2, duration_ms: 1000, pages: [pIneligible, pEligible] } } as CrawlRunRecord;
    const verified = runTaskVerification('sprs-ineligible', run);
    expect(verified[0].verdict?.delta).toBeNull();
  });
});
