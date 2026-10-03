import { expect, it } from 'vitest';
import { analyzeGscCannibalization } from '@/services/gscTracker/cannibalization';
import type { GscMetricRow } from '@/types';

const row = (page: string, impressions = 50, query = 'seo'): GscMetricRow => ({ query,
  page: `https://example.com/${page}`, impressions, clicks: 0, ctr: 0, position: 12 });

it('does not infer observed pairs from marginal lists or legacy snapshots', () => {
  expect(analyzeGscCannibalization({})).toEqual({ status: 'unavailable', truncated: false, candidates: [] });
  expect(analyzeGscCannibalization({ query_pages: [] })).toEqual({ status: 'available', truncated: false, candidates: [] });
});
it('finds significant competing URLs using actual observed query cohorts', () => {
  const rows = [row('b', 30), { ...row('a', 70), clicks: 7, ctr: 10 }, row('other', 100, 'different')];
  const result = analyzeGscCannibalization({ query_pages: rows, query_pages_may_be_truncated: true });
  expect(result.status).toBe('available');
  expect(result.truncated).toBe(true);
  expect(result.candidates).toHaveLength(1);
  expect(result.candidates[0]).toMatchObject({ query: 'seo', impressions: 100, clicks: 7 });
  expect(result.candidates[0].pages.map(page => [page.page, page.sharePercent])).toEqual([
    ['https://example.com/a', 70], ['https://example.com/b', 30],
  ]);
  expect(rows[0].page).toBe('https://example.com/b');
});
it('requires at least two significant URLs and enough impressions, with inclusive thresholds', () => {
  expect(analyzeGscCannibalization({ query_pages: [row('a', 19), row('b', 19)] }).candidates).toEqual([]);
  expect(analyzeGscCannibalization({ query_pages: [row('a', 980), row('b', 20)] }).candidates).toEqual([]);
  expect(analyzeGscCannibalization({ query_pages: [row('a', 80), row('b', 20)] }).candidates).toHaveLength(1);
  expect(analyzeGscCannibalization({ query_pages: [row('a', 50)] }).candidates).toEqual([]);
  expect(analyzeGscCannibalization({ query_pages: [row('a', 0), row('b', 0)] }).candidates).toEqual([]);
});
it('rejects corrupt rows, duplicate observations and unsafe page schemes', () => {
  for (const rows of [[row('a'), row('a')], [{ ...row('a'), impressions: NaN }],
    [{ ...row('a'), clicks: -1 }], [{ ...row('a'), position: Infinity }],
    [{ ...row('a'), ctr: -1 }], [{ ...row('a'), query: ' ' }],
    [{ ...row('a'), page: 'javascript:alert(1)' }], [{ ...row('a'), page: 'not a URL' }]]) {
    expect(analyzeGscCannibalization({ query_pages: rows }).status).toBe('invalid');
  }
});
it('rejects invalid thresholds and oversized provider data', () => {
  for (const options of [{ minImpressions: -1 }, { minImpressions: NaN }, { minSharePercent: 101 }, { minSharePercent: -1 }]) {
    expect(analyzeGscCannibalization({ query_pages: [] }, options).status).toBe('invalid');
  }
  expect(analyzeGscCannibalization({ query_pages: Array.from({ length: 25001 }, (_, i) => row(String(i))) }).status).toBe('invalid');
});
it('supports explicit thresholds and ranks cohorts deterministically by observed impressions', () => {
  const result = analyzeGscCannibalization({ query_pages: [row('a', 20, 'z'), row('b', 20, 'z'), row('c', 40, 'a'), row('d', 40, 'a')] },
    { minImpressions: 1, minSharePercent: 0 });
  expect(result.candidates.map(candidate => candidate.query)).toEqual(['a', 'z']);
});
it('rejects malformed runtime input and overflowing cohort totals', () => {
  for (const input of [null, {}, 'rows']) {
    expect(analyzeGscCannibalization({ query_pages: input as unknown as GscMetricRow[] }).status).toBe('invalid');
  }
  for (const invalid of [null, { ...row('a'), query: 1 }, { ...row('a'), page: 1 }]) {
    expect(analyzeGscCannibalization({ query_pages: [invalid as unknown as GscMetricRow] }).status).toBe('invalid');
  }
  expect(analyzeGscCannibalization({ query_pages: [row('a', 1e308), row('b', 1e308)] }).status).toBe('invalid');
  expect(analyzeGscCannibalization({ query_pages: [{ ...row('a'), clicks: 1e308 }, { ...row('b'), clicks: 1e308 }] }).status).toBe('invalid');
});
it('breaks equal impression ties by query and URL without mixing query identities', () => {
  const result = analyzeGscCannibalization({ query_pages: [row('b', 20, 'z'), row('a', 20, 'z'), row('b', 20, 'a'), row('a', 20, 'a')] });
  expect(result.candidates.map(candidate => candidate.query)).toEqual(['a', 'z']);
  expect(result.candidates[0].pages.map(page => page.page)).toEqual(['https://example.com/a', 'https://example.com/b']);
});
