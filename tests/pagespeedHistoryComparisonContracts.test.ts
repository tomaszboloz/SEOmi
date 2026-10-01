import { expect, it } from 'vitest';
import { numeric, psiMetricValue, cruxMetricValue, delta, comparePageSpeedSnapshots } from '@/services/pagespeedHistory/comparison';
import { historySnapshot, pageSpeedReport, cruxReport } from './fixtures/pageSpeedHistory';
it('preserves measured zero and rejects nonnumeric/nonfinite measurements', () => {
  expect(numeric(0)).toBe(0); expect(numeric(-2)).toBe(-2);
  for (const value of [null, undefined, '0', Infinity, NaN]) expect(numeric(value)).toBeNull();
  expect(delta(0, 1)).toBe(1); expect(delta(null, 1)).toBeNull(); expect(delta(1, null)).toBeNull();
});
it('reads lab and field values only from the requested metric', () => {
  const pageSpeed = pageSpeedReport(); pageSpeed.metrics.observed = { id: 'observed', title: 'Observed', numericValue: 0, score: null, displayValue: null };
  expect(psiMetricValue(historySnapshot({ pageSpeed }), 'observed')).toBe(0);
  expect(psiMetricValue(historySnapshot({ pageSpeed: null }), 'observed')).toBeNull();
  const crux = { ...cruxReport(), response: { record: { metrics: { observed: { percentiles: { p75: 0 } }, missing: {}, invalid: 'bad' } } } };
  expect(cruxMetricValue(historySnapshot({ crux }), 'observed')).toBe(0);
  for (const id of ['missing', 'invalid', 'absent']) expect(cruxMetricValue(historySnapshot({ crux }), id)).toBeNull();
  for (const response of [{}, { record: { metrics: 'bad' } }, { record: {} }]) expect(cruxMetricValue(historySnapshot({ crux: { ...crux, response } }), 'observed')).toBeNull();
  expect(cruxMetricValue(historySnapshot({ crux: null }), 'observed')).toBeNull();
});
it('compares zero, increased and missing metrics without inventing deltas', () => {
  const baseline = historySnapshot({ pageSpeed: null, crux: null });
  const current = historySnapshot({ crux: { ...cruxReport(), response: { record: { metrics: { largest_contentful_paint: { percentiles: { p75: 1200 } } } } } } });
  const missing = comparePageSpeedSnapshots(baseline, current);
  expect(missing.categoryDeltas.find(item => item.key === 'performance')).toEqual({ key: 'performance', baseline: null, current: 0, delta: null });
  expect(missing.cruxDeltas[0]).toEqual({ id: 'largest_contentful_paint', baseline: null, current: 1200, delta: null });
  const both = comparePageSpeedSnapshots(current, current);
  expect(both.categoryDeltas.find(item => item.key === 'performance')?.delta).toBe(0);
  expect(both.cruxDeltas[0].delta).toBe(0);
  expect(both.metricDeltas.every(item => item.delta === null)).toBe(true);
});
