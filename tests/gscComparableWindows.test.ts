import { expect, it } from 'vitest';
import { compareGscSnapshots, snapshotGscPerformance } from '@/services/gscPerformanceTracker';
import { gscData } from './fixtures/gscTracker';
import i18n from '@/i18n';

const snapshot = (start_date: string, end_date: string) => snapshotGscPerformance(gscData({ start_date, end_date }));

it('rejects a shorter window rather than classifying constant daily traffic as a decline', () => {
  const baseline = snapshot('2026-07-01', '2026-07-28');
  const current = snapshot('2026-08-01', '2026-08-07');
  baseline.queries[0].clicks = 280; current.queries[0].clicks = 70;
  const result = compareGscSnapshots(baseline, current);
  expect(result).toEqual({ compatible: false, reason: i18n.t('runtimeErrors.gsc.differentDurations'),
    queryChanges: [], pageChanges: [], uncertainBecauseTruncated: true });
});

it.each([
  ['2024-02-01', '2024-02-29', '2024-03-01', '2024-03-29'],
  ['2026-03-15', '2026-04-11', '2026-10-15', '2026-11-11'],
  ['2025-12-20', '2026-01-16', '2026-01-17', '2026-02-13'],
  ['2026-01-01', '2026-01-01', '2026-01-02', '2026-01-02'],
])('accepts equal inclusive UTC windows %s..%s and %s..%s', (a, b, c, d) => {
  expect(compareGscSnapshots(snapshot(a, b), snapshot(c, d)).compatible).toBe(true);
});

it.each([
  ['2026-02-30', '2026-03-01'], ['bad', '2026-03-01'],
  ['2026-3-01', '2026-03-02'], ['2026-03-02', '2026-03-01'],
  ['2026-02-01', '2026-02-29'], ['2026-01-01', 'bad'],
])('rejects malformed or reversed source window %s..%s', (a, b) => {
  const result = compareGscSnapshots(snapshot(a, b), snapshot('2026-08-01', '2026-08-28'));
  expect(result.compatible).toBe(false);
  expect(result.reason).toBe(i18n.t('runtimeErrors.gsc.invalidDates'));
  expect(result.queryChanges).toEqual([]);
});

it('rejects invalid dates in the current report too', () => {
  expect(compareGscSnapshots(snapshot('2026-07-01', '2026-07-28'), snapshot('2026-08-01', '2026-08-32')))
    .toMatchObject({ compatible: false, reason: i18n.t('runtimeErrors.gsc.invalidDates') });
});

it('reports one-sided observations separately without inventing zero or loss metrics', () => {
  const baseline = snapshot('2026-07-01', '2026-07-28');
  const current = snapshot('2026-08-01', '2026-08-28');
  baseline.queries.push({ ...baseline.queries[0], query: 'baseline only' });
  current.queries.push({ ...current.queries[0], query: 'current only' });
  baseline.pages.push({ ...baseline.pages[0], page: 'https://example.com/old' });
  current.pages.push({ ...current.pages[0], page: 'https://example.com/new' });
  const result = compareGscSnapshots(baseline, current);
  expect(result).toMatchObject({ compatible: true, unmatchedRows: {
    baselineQueries: ['baseline only'], currentQueries: ['current only'],
    baselinePages: ['https://example.com/old'], currentPages: ['https://example.com/new'],
  } });
  expect(result.queryChanges.map(row => row.key)).toEqual(['query']);
  expect(result.pageChanges.map(row => row.key)).toEqual(['https://example.com']);
  expect(result.queryChanges[0].potentialDecline).toBe(false);
});

it('deduplicates and sorts one-sided identities while preserving exact source labels', () => {
  const baseline = snapshot('2026-07-01', '2026-07-28');
  const current = snapshot('2026-08-01', '2026-08-28');
  baseline.queries = ['z', 'z', 'a', ' query '].map(query => ({ ...baseline.queries[0], query }));
  expect(compareGscSnapshots(baseline, current).unmatchedRows)
    .toMatchObject({ baselineQueries: [' query ', 'a', 'z'], currentQueries: ['query'] });
  expect(baseline.queries.map(row => row.query)).toEqual(['z', 'z', 'a', ' query ']);
});
