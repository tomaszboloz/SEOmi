import { afterEach, expect, it, vi } from 'vitest';
import { normalizedFilters, filtersEqual } from '@/services/gscTracker/filters';
import { latestCompleteGscDateRange, validateGscDateRange } from '@/services/gscPerformanceTracker';
import type { GscPerformanceFilters } from '@/types';
import i18n from '@/i18n';
afterEach(() => vi.useRealTimers());
it('normalizes only actual filters without mutating caller input', () => {
  const filters: GscPerformanceFilters = { search_type: 'web', device: 'MOBILE', country: ' POL ' };
  expect(normalizedFilters(filters)).toEqual({ search_type: 'web', device: 'MOBILE', country: 'pol' });
  expect(filters.country).toBe(' POL ');
  expect(normalizedFilters()).toEqual({});
  expect(normalizedFilters({ country: ' ' })).toEqual({});
});
it.each([
  [undefined, {}, true], [{ country: 'POL' }, { country: ' pol ' }, true],
  [{ search_type: 'web' }, { search_type: 'image' }, false],
  [{ device: 'DESKTOP' }, { device: 'MOBILE' }, false],
  [{ country: 'pol' }, { country: 'usa' }, false],
  [{ search_type: 'web' }, undefined, false],
  [{ device: 'MOBILE' }, {}, false], [{ country: 'pol' }, {}, false],
] as Array<[GscPerformanceFilters | undefined, GscPerformanceFilters | undefined, boolean]>)(
  'compares filters %j and %j', (left, right, equal) => expect(filtersEqual(left, right)).toBe(equal),
);
it('uses UTC calendar arithmetic across leap day and year boundaries', () => {
  expect(latestCompleteGscDateRange(new Date('2024-03-03T23:00:00-05:00'))).toEqual({ startDate: '2024-02-03', endDate: '2024-03-01' });
  expect(latestCompleteGscDateRange(new Date('2026-01-02T12:00:00Z'))).toEqual({ startDate: '2025-12-03', endDate: '2025-12-30' });
});
it('uses current time by default and accepts the latest complete day', () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-23T12:00:00Z'));
  expect(latestCompleteGscDateRange()).toEqual({ startDate: '2026-08-24', endDate: '2026-09-20' });
  expect(validateGscDateRange({ startDate: '2026-09-20', endDate: '2026-09-20' })).toBeNull();
});
it.each(['bad', '2026-02-30', '2026-13-01', '2026-1-01'])('rejects malformed start/end date %s', date => {
  expect(validateGscDateRange({ startDate: date, endDate: '2026-01-01' })).toBe(i18n.t('runtimeErrors.gsc.invalidDates'));
  expect(validateGscDateRange({ startDate: '2026-01-01', endDate: date })).toBe(i18n.t('runtimeErrors.gsc.invalidDates'));
});
