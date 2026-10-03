import { expect, it } from 'vitest';
import { normalizePageSpeedSnapshots } from '@/services/pagespeedHistory';
import { historySnapshot, pageSpeedReport, cruxReport } from './fixtures/pageSpeedHistory';
it.each([
  { ...pageSpeedReport(), categories: undefined },
  { ...pageSpeedReport(), strategy: 'unsupported' },
])('rejects malformed persisted PSI instead of restoring unusable reports: %j', report => {
  expect(normalizePageSpeedSnapshots([historySnapshot({ pageSpeed: report as never, crux: null })])).toEqual([]);
});
it.each([
  { ...cruxReport(), scope: 'unsupported' },
  { ...cruxReport(), formFactor: 'unsupported' },
])('rejects unsupported persisted CrUX selectors: %j', report => {
  expect(normalizePageSpeedSnapshots([historySnapshot({ pageSpeed: null, crux: report as never })])).toEqual([]);
});
