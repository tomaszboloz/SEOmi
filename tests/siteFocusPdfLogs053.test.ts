import { afterEach, describe, expect, it } from 'vitest';
import { summarizeSiteFocus } from '@/services/export/focusSummary';
import { emptyImportState, type LogImportState } from '@/services/logIntelligence';
import { saveLogState } from '@/services/logIntelligence/storage';
import { buildSiteFocusReport, SFS_ALGORITHM_VERSION, SFS_CONFIG_HASH } from '@/services/siteFocus';
import { logVisitEvidence, protectionRows, verifiedGooglebotHits } from '@/services/urlProtection';
import { clearSnapshots } from '@/services/urlTelemetry';
import { diabetesSite } from './siteFocusFixtures';

const START = 'https://diabetes.test/';
const report = () => buildSiteFocusReport(diabetesSite(), START, { language: 'en', now: '2026-10-30T00:00:00Z' });
const agg = (path: string, family: 'googlebot' | 'bingbot', status: 'verified' | 'spoofed', hits: number) => ({
  path, family, status, hits, statusGroups: { '2xx': hits, '3xx': 0, '4xx': 0, '5xx': 0 }, latencySumMs: 0, latencyCount: 0, bytes: 0,
  firstAt: 1, lastAt: 2, intervalSumMs: 0, intervalCount: 0, maxIntervalMs: 0,
});
const logs = (paths: Array<[string, number]>): LogImportState => ({
  ...emptyImportState(), lines: 50, firstAt: 1, lastAt: 2, days: ['2026-10-01', '2026-10-02'],
  aggs: Object.fromEntries([
    ...paths.map(([path, hits]) => [`${path}|g`, agg(path, 'googlebot', 'verified', hits)]),
    ['spoof', agg(paths[0]?.[0] ?? '/', 'googlebot', 'spoofed', 99)], ['bing', agg('/x', 'bingbot', 'verified', 5)],
  ]),
});

afterEach(() => { localStorage.clear(); clearSnapshots(); });

describe('Site Focus PDF summary (#53)', () => {
  it('sends unavailable instead of a critical 0 when no page was scored', () => {
    const empty = buildSiteFocusReport([], START, { now: '2026-10-30T00:00:00Z' });
    const summary = summarizeSiteFocus(empty);
    expect(summary).toMatchObject({ score: null, band: 'unavailable', confidence: null, on_topic_ratio: null, unavailable: true });
    expect(summary.profile).toEqual({ id: 'sfs-lexical-tfidf', algorithm_version: SFS_ALGORITHM_VERSION, config_hash: SFS_CONFIG_HASH });
  });

  it('keeps measured values and the profile for a scored crawl', () => {
    const scored = report();
    const summary = summarizeSiteFocus(scored);
    expect(summary.score).toBe(scored.score);
    expect(summary.band).toBe(scored.band);
    expect(summary.unavailable).toBeUndefined();
    expect(summary.brand_filtered).toBeUndefined();
  });
});

describe('server-log evidence in URL protection (#81 GEM-81-08)', () => {
  it('is unavailable without imported logs, never a measured zero', () => {
    const read = logVisitEvidence('p1');
    expect(read(`${START}a`)).toEqual({ signal: 'botHits', state: 'unavailable', value: null, norm: null, days: null });
    expect(logVisitEvidence(null)('not a url').state).toBe('unavailable');
  });

  it('counts only verified Googlebot hits per path and reports the covered days', () => {
    const state = logs([['/a/', 3], ['/a', 2], ['/b?x=1', 4]]);
    expect([...verifiedGooglebotHits(state)]).toEqual([['/a', 5], ['/b?x=1', 4]]);
    const read = logVisitEvidence('p1', state);
    expect(read(`${START}a`)).toEqual({ signal: 'botHits', state: 'measured', value: 5, norm: null, days: 2 });
    expect(read(`${START}b?x=1`).value).toBe(4);
    expect(read(`${START}never-seen`)).toMatchObject({ state: 'measured', value: 0 });
    expect(read('::bad::')).toMatchObject({ state: 'unavailable', value: null });
  });

  it('adds the log row to every protection row without changing the decision', () => {
    const before = protectionRows(report(), 'p1');
    expect(before.rows.length).toBeGreaterThan(0);
    const low = new URL(before.rows[0].url).pathname;
    saveLogState('p1', logs([[low, 7]]));
    const after = protectionRows(report(), 'p1');
    expect(after.rows.map((row) => row.result.decision)).toEqual(before.rows.map((row) => row.result.decision));
    expect(after.rows[0].result.evidence.at(-1)).toMatchObject({ signal: 'botHits', state: 'measured', value: 7 });
    expect(before.rows[0].result.evidence.at(-1)).toMatchObject({ signal: 'botHits', state: 'unavailable' });
  });
});
