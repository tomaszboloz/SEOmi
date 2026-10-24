import { beforeEach, describe, expect, it } from 'vitest';
import { evaluateIntervention } from '@/services/experiments/evaluate';
import { readGscSnapshots } from '@/services/gscTracker/read';
import { experimentNow, experimentPage, intervention, savedExperimentPair, savedExperimentSnapshot } from './fixtures/experiments';

beforeEach(() => localStorage.clear());
const evaluate = (snapshots = readGscSnapshots('p1'), url = intervention.url) =>
  evaluateIntervention({ ...intervention, url }, snapshots, experimentNow);

describe('observational before/after evaluation', () => {
  it('compares saved page metrics against totals minus that page in percentage points', () => {
    savedExperimentPair();
    const result = evaluate();
    expect(result.status).toBe('ready');
    expect(result.reasons).toEqual([]);
    expect(result.baseline).toMatchObject({ startDate: '2026-09-01', endDate: '2026-09-10', days: 10 });
    expect(result.followUp).toMatchObject({ startDate: '2026-09-11', endDate: '2026-09-20', days: 10 });
    expect(result.change?.clicks).toEqual({ before: 40, after: 60, absoluteChange: 20, relativeChange: 50 });
    expect(result.change?.impressions.relativeChange).toBe(50);
    expect(result.change?.position).toEqual({ before: 8, after: 5, absoluteChange: -3 });
    expect(result.restOfSite?.clicks).toEqual({ before: 60, after: 60, absoluteChange: 0, relativeChange: 0 });
    expect(result.relativeVsSite).toEqual({ clicks: 50, impressions: 50 });
    expect(result.limitations).toEqual(['observational', 'uncontrolled-factors']);
    expect(result).not.toHaveProperty('probability');
  });

  it('uses the latest baseline and earliest follow-up, ignoring overlapping windows', () => {
    const pair = savedExperimentPair();
    const old = savedExperimentSnapshot('2026-08-01', '2026-08-10');
    const later = savedExperimentSnapshot('2026-10-01', '2026-10-10');
    const overlap = savedExperimentSnapshot('2026-09-05', '2026-09-14');
    const result = evaluate([later, overlap, old, ...pair]);
    expect(result.baseline?.startDate).toBe(pair[0].start_date);
    expect(result.followUp?.startDate).toBe(pair[1].start_date);
  });

  it('uses latest capture as a deterministic tie-breaker', () => {
    const pair = savedExperimentPair();
    const laterBaseline = { ...pair[0], captured_at: '2026-10-01T12:00:00Z', pages: [experimentPage(50)] };
    const laterFollow = { ...pair[1], captured_at: '2026-10-01T12:00:00Z', pages: [experimentPage(70)] };
    const result = evaluate([...pair, laterBaseline, laterFollow]);
    expect(result.change?.clicks.before).toBe(50);
    expect(result.change?.clicks.after).toBe(70);
  });

  it('normalizes host case, fragments, trailing dots and slashes but preserves origin and query', () => {
    const pair = savedExperimentPair();
    expect(evaluate(pair, 'https://EXAMPLE.COM./article///#part').change?.clicks.before).toBe(40);
    expect(evaluate(pair, 'https://example.com/article?different=1').change?.clicks.before).toBe(0);
    expect(evaluate(pair, 'http://example.com/article').change?.clicks.before).toBe(0);
  });

  it('aggregates normalized duplicate rows with impression-weighted position', () => {
    savedExperimentSnapshot('2026-09-01', '2026-09-10', {
      pages: [experimentPage(20, 100, 4), experimentPage(20, 300, 8, `${intervention.url}/#x`)],
    });
    savedExperimentSnapshot('2026-09-11', '2026-09-20');
    const result = evaluate();
    expect(result.change?.clicks.before).toBe(40);
    expect(result.change?.position.before).toBe(7);
  });

  it('compares whole-site totals without inventing a separate control, even with truncated page rows', () => {
    savedExperimentSnapshot('2026-09-01', '2026-09-10', { pages_may_be_truncated: true });
    savedExperimentSnapshot('2026-09-11', '2026-09-20', { total_clicks: 120, pages_may_be_truncated: true });
    const result = evaluate(undefined, 'site');
    expect(result.status).toBe('ready');
    expect(result.change?.clicks.relativeChange).toBe(20);
    expect(result.restOfSite).toBeNull();
    expect(result.relativeVsSite).toBeNull();
    expect(result.limitations).toContain('no-control');
  });

  it.each([30, 29])('accepts baseline volume at 30, not below it (%i)', clicks => {
    savedExperimentSnapshot('2026-09-01', '2026-09-10', { pages: [experimentPage(clicks)] });
    savedExperimentSnapshot('2026-09-11', '2026-09-20');
    expect(evaluate().status).toBe(clicks === 30 ? 'ready' : 'inconclusive');
    expect(evaluate().reasons.includes('low-volume')).toBe(clicks < 30);
  });

  it('reports increasing position as a signed absolute difference, not a percentage', () => {
    savedExperimentSnapshot();
    savedExperimentSnapshot('2026-09-11', '2026-09-20', { pages: [experimentPage(40, 400, 11)] });
    expect(evaluate().change?.position).toEqual({ before: 8, after: 11, absoluteChange: 3 });
  });
});
