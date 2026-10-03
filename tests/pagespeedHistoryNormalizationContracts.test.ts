import { expect, it } from 'vitest';
import { validDate, validReport, validCrux, normalizePageSpeedSnapshots } from '@/services/pagespeedHistory/normalization';
import { historySnapshot, pageSpeedReport, cruxReport } from './fixtures/pageSpeedHistory';
it('validates dates without manufacturing a date from non-string values', () => {
  expect(validDate('2026-10-01T02:00:00+02:00', 'fallback')).toBe('2026-10-01T00:00:00.000Z');
  expect(validDate('not-date', 'fallback')).toBe('fallback'); expect(validDate(0, 'fallback')).toBe('fallback');
});
it.each([null, [], 'bad', 1, {}, { ...pageSpeedReport(), requestedUrl: 1 }, { ...pageSpeedReport(), categories: [] }, { ...pageSpeedReport(), categories: 'bad' }])('rejects unsupported PSI shape %j', value => {
  expect(validReport(value)).toBeNull();
});
it('retains valid reports and declines malformed CrUX identity/selectors', () => {
  const psi = pageSpeedReport(), crux = cruxReport();
  expect(validReport(psi)).toBe(psi); expect(validCrux(crux)).toBe(crux);
  for (const value of [null, [], 'bad', 1, {}, { ...crux, target: 1 }]) expect(validCrux(value)).toBeNull();
});
it('normalizes only usable rows, legacy identity, supported selectors and bounded ordering', () => {
  expect(normalizePageSpeedSnapshots(null)).toEqual([]);
  const raw = [null, 1, [], { url: 1 }, { url: 'https://empty.test', pageSpeed: {} },
    { url: ' https://legacy.test ', capturedAt: 0, pageSpeed: { ...pageSpeedReport(), strategy: 'desktop' }, crux: { ...cruxReport(), scope: 'origin', formFactor: 'TABLET' } },
    historySnapshot({ id: 'same', capturedAt: '2026-10-02T00:00:00Z', strategy: 'desktop', formFactor: 'DESKTOP', scope: 'origin' }), historySnapshot({ id: 'same' }),
    historySnapshot({ id: '', pageSpeed: null, crux: cruxReport(), strategy: undefined, formFactor: undefined, scope: undefined } as never),
  ];
  const normalized = normalizePageSpeedSnapshots(raw, '2026-10-01T00:00:00.000Z');
  expect(normalized.map(row => row.id)).toEqual(['same', 'legacy-2', 'legacy-5']);
  expect(normalized[1]).toMatchObject({ url: 'https://legacy.test', capturedAt: '2026-10-01T00:00:00.000Z', strategy: 'desktop', scope: 'origin', formFactor: 'TABLET' });
  expect(normalized[2]).toMatchObject({ strategy: 'mobile', scope: 'url', formFactor: 'PHONE' });
  const defaults = normalizePageSpeedSnapshots([historySnapshot({ crux: null, strategy: undefined, formFactor: undefined, scope: undefined } as never)]);
  expect(defaults[0]).toMatchObject({ strategy: 'mobile', scope: 'url', formFactor: 'PHONE' });
  expect(normalizePageSpeedSnapshots(Array.from({ length: 30 }, (_, index) => historySnapshot({ id: `run-${index}` })))).toHaveLength(24);
});
