import { beforeEach, describe, expect, it } from 'vitest';
import { evaluateIntervention } from '@/services/experiments/evaluate';
import { experimentNow, experimentPage, intervention, savedExperimentPair, savedExperimentSnapshot } from './fixtures/experiments';

beforeEach(() => localStorage.clear());
const evaluate = (snapshots = savedExperimentPair()) => evaluateIntervention(intervention, snapshots, experimentNow);

describe('evaluation limits and missing evidence', () => {
  it('returns both missing-period reasons and never synthesizes measurements', () => {
    expect(evaluate([])).toMatchObject({ status: 'inconclusive', reasons: ['no-baseline', 'no-follow-up'], change: null });
    expect(evaluate([savedExperimentSnapshot()]).reasons).toEqual(['no-follow-up']);
    expect(evaluate([savedExperimentSnapshot('2026-09-11', '2026-09-20')]).reasons).toEqual(['no-baseline']);
  });

  it('leaves future interventions pending, including with already saved data', () => {
    const planned = { ...intervention, date: '2026-10-25' };
    expect(evaluateIntervention(planned, savedExperimentPair(), experimentNow)).toMatchObject({
      status: 'pending', reasons: ['pending'], baseline: null, followUp: null, change: null,
    });
    expect(evaluateIntervention({ ...planned, date: '2026-10-24' }, [], experimentNow).status).toBe('inconclusive');
  });

  it.each([{ site_url: 'sc-domain:other.com' }, { filters: { device: 'MOBILE' as const } }])('rejects scope drift %j', extra => {
    const result = evaluate([savedExperimentSnapshot(), savedExperimentSnapshot('2026-09-11', '2026-09-20', extra)]);
    expect(result.reasons).toEqual(['incomparable-scope']);
    expect(result.change).toBeNull();
    expect(result.baseline).not.toBeNull();
    expect(result.followUp).not.toBeNull();
  });

  it('does not silently replace the nearest window with a more favorable scope', () => {
    const pair = savedExperimentPair();
    const wrong = savedExperimentSnapshot('2026-09-12', '2026-09-21', { site_url: 'sc-domain:other.com' });
    expect(evaluate([...pair, wrong]).status).toBe('ready');
    expect(evaluate([pair[0], wrong]).status).toBe('inconclusive');
  });

  it('requires the saved property to cover the intervention URL', () => {
    expect(evaluateIntervention({ ...intervention, url: 'https://other.com/article' }, savedExperimentPair(), experimentNow)
      .reasons).toContain('incomparable-scope');
  });

  it('compares normalized filters and marks their scope', () => {
    const before = savedExperimentSnapshot('2026-09-01', '2026-09-10', { filters: { country: 'pol', search_type: 'web' } });
    const after = savedExperimentSnapshot('2026-09-11', '2026-09-20', { filters: { search_type: 'web', country: 'pol' } });
    expect(evaluate([before, { ...after, filters: { search_type: 'web', country: ' POL ' } }]).limitations).toContain('filtered-scope');
  });

  it.each([['2026-09-21', 'ready'], ['2026-09-22', 'inconclusive']])('uses inclusive days and the 10%% boundary (%s)', (end, status) => {
    const result = evaluate([savedExperimentSnapshot(), savedExperimentSnapshot('2026-09-11', end)]);
    expect(result.status).toBe(status);
    expect(result.reasons.includes('period-length-mismatch')).toBe(status === 'inconclusive');
  });

  it.each(['2026-09-09', 'invalid'])('rejects malformed baseline period %s', start => {
    const pair = savedExperimentPair();
    expect(evaluate([{ ...pair[0], start_date: start, end_date: '2026-09-08' }, pair[1]]).status).toBe('inconclusive');
  });

  it('rejects invalid follow-up duration', () => {
    const pair = savedExperimentPair();
    expect(evaluate([pair[0], { ...pair[1], end_date: 'invalid' }]).limitations).toContain('invalid-period');
  });

  it.each([0, 1])('marks truncated page rows in either period (%i)', index => {
    const pair = savedExperimentPair();
    pair[index].pages_may_be_truncated = true;
    const result = evaluate(pair);
    expect(result.status).toBe('inconclusive');
    expect(result.reasons).toContain('rows-truncated');
    expect(result.change).not.toBeNull();
  });

  it('does not interpret missing truncated rows as measured zeros', () => {
    const pair = savedExperimentPair();
    pair[0].pages = [];
    pair[0].pages_may_be_truncated = true;
    expect(evaluate(pair)).toMatchObject({ change: null, reasons: ['rows-truncated'] });
  });

  it('reports measured zero and unknown position only when the page list is complete', () => {
    const pair = savedExperimentPair();
    pair[0].pages = [];
    const result = evaluate(pair);
    expect(result.change?.clicks).toMatchObject({ before: 0, relativeChange: null });
    expect(result.change?.position.absoluteChange).toBeNull();
    expect(result.relativeVsSite?.clicks).toBeNull();
    expect(result.limitations).toEqual(expect.arrayContaining(['zero-baseline', 'low-volume']));
  });

  it('keeps unknown relative controls null when the rest of site baseline is zero', () => {
    const pair = savedExperimentPair();
    pair[0].total_clicks = 40;
    pair[0].total_impressions = 400;
    const result = evaluate(pair);
    expect(result.restOfSite?.position.before).toBeNull();
    expect(result.relativeVsSite).toEqual({ clicks: null, impressions: null });
    expect(result.limitations).toContain('zero-baseline');
  });

  it('does not clamp negative controls to fabricated zeros', () => {
    const pair = savedExperimentPair();
    pair[1].pages = [experimentPage(200)];
    expect(evaluate(pair)).toMatchObject({ status: 'inconclusive', restOfSite: null, reasons: ['incomparable-scope'] });
    expect(evaluate(pair).limitations).toContain('inconsistent-totals');
  });
});
