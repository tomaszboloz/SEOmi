import { describe, expect, it } from 'vitest';
import { buildLogMatrixView, latestLogCrawl } from '@/components/Domain/crawlResults/logIntelligence/matrixView';
import { emptyImportState } from '@/services/logIntelligence';
import { coveredLogState, logRun } from './fixtures/logIntel';

describe('crawl matrix presentation evidence', () => {
  it('uses the newest completed crawl of the active project, not the selected or another project run', () => {
    const old = logRun([], { completedAt: '2026-10-01', id: 'old' });
    const latest = logRun([], { id: 'latest' });
    const other = logRun([], { projectId: 'p2', completedAt: '2026-12-01' });
    const invalid = logRun([], { completedAt: 'invalid' });
    const legacy = logRun([], { projectId: undefined });
    const cancelled = logRun([], { result: { ...latest.result, cancelled: true } });
    const timeout = logRun([], { result: { ...latest.result, timed_out: true } });
    expect(latestLogCrawl([old, latest, old, other, invalid, legacy, cancelled, timeout], 'p1')).toBe(latest);
    expect(latestLogCrawl([], 'p1')).toBeUndefined();
    expect(latestLogCrawl([other], 'p1')).toBeUndefined();
  });
  it('shows crawl paths without inventing hits when there are no logs or scores', () => {
    const view = buildLogMatrixView(emptyImportState(), logRun([['/a'], ['/b?query=yes']]));
    expect(view).toMatchObject({ hasScores: false, sufficient: false, coverageDays: 0, periodDays: 0 });
    expect(view.rows).toEqual(['/a', '/b'].map((path) => ({ path, family: null, status: 'unknown', hits: null, errorShare: null, verdict: 'no-logs' })));
    expect(buildLogMatrixView(emptyImportState()).rows).toEqual([]);
  });
  it.each([undefined, null, '80', NaN, Infinity, -1, 101])('does not invent a score from %s', (score) => {
    const view = buildLogMatrixView(coveredLogState(), logRun([['/a', score]]));
    expect(view.hasScores).toBe(false);
    expect(view.rows[0].verdict).toBe('inconclusive');
  });
  it.each([[30, 30, 'waste'], [1, 80, 'starvation'], [25, 30, 'ok'], [30, 0, 'waste'], [3, 100, 'ok']])('uses real TRS: %s hits, score %s → %s', (hits, score, verdict) => {
    const view = buildLogMatrixView(coveredLogState(Number(hits)), logRun([['/a', score]]));
    expect(view).toMatchObject({ hasScores: true, sufficient: true, coverageDays: 30, periodDays: 30 });
    expect(view.rows[0]).toMatchObject({ hits, verdict, errorShare: 1 / Number(hits) });
  });
  it.each(['claimed', 'unknown', 'spoofed'] as const)('does not promote %s bots to verified or a reliable verdict', (status) => {
    expect(buildLogMatrixView(coveredLogState(30, status), logRun([['/a', 30]])).rows[0]).toMatchObject({ status, verdict: 'inconclusive' });
  });
  it('keeps partially covered rows inconclusive and unknown crawl paths separate', () => {
    const state = coveredLogState();
    state.days = ['2026-10-30'];
    const view = buildLogMatrixView(state, logRun([['/a', 30], ['/unseen', 80], ['http://[invalid']]));
    expect(view.sufficient).toBe(false);
    expect(view.rows.map((row) => row.path)).toEqual(['/a', '/unseen']);
    expect(view.rows.every((row) => row.verdict === 'inconclusive')).toBe(true);
  });
  it('separates families/statuses and reports zero-hit and no-coverage aggregates honestly', () => {
    const state = coveredLogState();
    const aggregate = Object.values(state.aggs)[0];
    state.aggs.bing = { ...aggregate, family: 'bingbot', status: 'claimed' };
    state.aggs.unverified = { ...aggregate, status: 'claimed' };
    state.aggs.zero = { ...aggregate, path: '/zero', hits: 0, statusGroups: { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0 } };
    const view = buildLogMatrixView(state);
    expect(view.rows).toHaveLength(4);
    expect(view.rows.find((row) => row.path === '/zero')?.errorShare).toBeNull();
    state.days = [];
    expect(buildLogMatrixView(state).rows.every((row) => row.verdict === 'no-logs')).toBe(true);
  });
});
