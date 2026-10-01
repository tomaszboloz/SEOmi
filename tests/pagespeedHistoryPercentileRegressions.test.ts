import { expect, it } from 'vitest';
import { comparePageSpeedSnapshots } from '@/services/pagespeedHistory';
import { historySnapshot, cruxReport } from './fixtures/pageSpeedHistory';
it('does not report a measured p75 from malformed zero-valued percentile metadata', () => {
  const malformed = historySnapshot({ crux: { ...cruxReport(), response: { record: { metrics: { largest_contentful_paint: { percentiles: 0 } } } } } });
  const comparison = comparePageSpeedSnapshots(malformed, malformed);
  expect(comparison.cruxDeltas[0]).toEqual({ id: 'largest_contentful_paint', baseline: null, current: null, delta: null });
});
