import { expect, it } from 'vitest';
import { cruxCategory, formatCruxCollectionPeriod, formatCruxValue, readCruxMetrics } from '@/components/Performance/cruxEvidence';
import { scoreColor, formatBytes, formatDelta } from '@/components/Performance/performanceFormatting';
import { emptySession, loadSession, storageKey } from '@/components/Performance/performanceSession';

const t = (key: string) => key;
it.each([false, true, [], {}, '', ' ', '0x10', NaN, Infinity, -1, null, undefined])('keeps invalid p75 %j unknown', (value) => {
  const metric = { metric: 'largest_contentful_paint', percentiles: { p75: value } };
  expect(formatCruxValue(metric, t)).toBe('pageSpeedUi.noP75');
  expect(cruxCategory(metric, t)).toBe('pageSpeedUi.crux.unrated');
});

it('ignores malformed records and histogram bins while retaining sourced percentiles', () => {
  for (const response of [null, [], {}, { record: { metrics: [] } }]) expect(readCruxMetrics(response)).toBeNull();
  const metrics = readCruxMetrics({ record: { metrics: {
    invalid: null, valid: { percentiles: { p75: '0.1' }, histogram: [{ density: 0.5 }] },
    badBins: { histogram: [{ density: -1 }, null] },
  } } });
  expect(metrics?.invalid).toBeUndefined();
  expect(metrics?.valid.histogram).toEqual([{ density: 0.5 }]);
  expect(metrics?.badBins.histogram).toEqual([]);
  expect(cruxCategory({ metric: '__proto__', percentiles: { p75: 1 } }, t)).toBe('pageSpeedUi.crux.unrated');
});

it('formats only complete, ordered, calendar-valid collection periods', () => {
  const period = (firstDate: unknown, lastDate: unknown) => ({ record: { collectionPeriod: { firstDate, lastDate } } });
  const start = { year: 2024, month: 2, day: 29 };
  const end = { year: 2024, month: 3, day: 1 };
  expect(formatCruxCollectionPeriod(period(start, end))).toBe('2024-02-29 – 2024-03-01');
  for (const response of [null, period(start, null), period(end, start), period({ year: 2023, month: 2, day: 29 }, end), period({ year: '2024', month: 2, day: 29 }, end)]) {
    expect(formatCruxCollectionPeriod(response)).toBeNull();
  }
});

it('preserves formatting boundaries without inventing missing measurements', () => {
  expect(scoreColor(null)).toBe('bg-slate-700');
  expect(scoreColor(90)).toBe('bg-emerald-500');
  expect(scoreColor(50)).toBe('bg-amber-400');
  expect(scoreColor(49)).toBe('bg-rose-500');
  expect(formatBytes(null)).toBeNull();
  expect(formatBytes(NaN)).toBeNull();
  expect(formatBytes(1024)).toBe('1.0 KiB');
  expect(formatBytes(128)).toBe('128 B');
  expect(formatDelta(null)).toBe('—');
  expect(formatDelta(2, ' ms')).toBe('+2 ms');
  expect(formatDelta(-0.15)).toBe('-0.15');
});

it('keeps persisted workspace input scoped to the selected project', () => {
  expect(emptySession('https://example.com').pageSpeed).toBeNull();
  expect(loadSession(null, 'https://example.com').url).toBe('https://example.com');
  localStorage.setItem(storageKey('format-project'), JSON.stringify({ url: 'https://example.com/page', strategy: 'desktop', formFactor: 'TABLET', scope: 'origin' }));
  expect(loadSession('format-project', '').formFactor).toBe('TABLET');
  expect(loadSession('other-format-project', 'https://other.example').url).toBe('https://other.example');
});
