import { beforeEach, expect, it } from 'vitest';
import { forgetGa4Reports, ga4ReportStorageKey, recallGa4Report } from '@/services/urlTelemetry/ga4Cache';
import { ga4Report } from './fixtures/ga4Report';

beforeEach(() => {
  forgetGa4Reports();
  localStorage.clear();
});

it.each(['{bad', 'null', '[]', '{}', '"text"'])('drops corrupt stored JSON/shape %s', raw => {
  localStorage.setItem(ga4ReportStorageKey('p'), raw);
  expect(recallGa4Report('p')).toBeNull();
  expect(localStorage.getItem(ga4ReportStorageKey('p'))).toBeNull();
});

it.each([
  { property: '' }, { property: 1 }, { start_date: '2026-02-30' }, { end_date: '2026-7-01' },
  { start_date: '2026-07-29' }, { rows: null }, { rows: [{}] }, { may_be_truncated: 'false' },
  { row_count: -1 }, { row_count: 1.5 }, { row_count: '1' }, { row_count: undefined },
  { status: 'failed' }, { host_name: '' }, { pages: -1 }, { pages: 0.5 },
  { rows: Array.from({ length: 5001 }, () => ga4Report().rows[0]) },
])('drops a report with invalid fields: %j', extra => {
  localStorage.setItem(ga4ReportStorageKey('p'), JSON.stringify({ ...ga4Report(), ...extra }));
  expect(recallGa4Report('p')).toBeNull();
  expect(localStorage.getItem(ga4ReportStorageKey('p'))).toBeNull();
});

it.each([
  { host_name: '' }, { landing_page: ' ' }, { sessions: -1 }, { engaged_sessions: Infinity },
  { key_events: NaN }, { sessions: '1' },
])('drops invalid report rows: %j', extra => {
  const report = ga4Report({ rows: [{ ...ga4Report().rows[0], ...extra } as never] });
  localStorage.setItem(ga4ReportStorageKey('p'), JSON.stringify(report));
  expect(recallGa4Report('p')).toBeNull();
  expect(localStorage.getItem(ga4ReportStorageKey('p'))).toBeNull();
});

it.each(['complete', 'partial', 'missing'] as const)('accepts %s, zero metrics and the row boundary', status => {
  const report = ga4Report({ status, pages: 0, row_count: 0, host_name: 'example.com', may_be_truncated: true,
    rows: Array.from({ length: 5000 }, () => ({ ...ga4Report().rows[0], sessions: 0, engaged_sessions: 0, key_events: 0 })) });
  localStorage.setItem(ga4ReportStorageKey('p'), JSON.stringify(report));
  expect(recallGa4Report('p')).toEqual(report);
});

it('accepts an empty observed report and null row count', () => {
  const report = ga4Report({ rows: [], row_count: null });
  localStorage.setItem(ga4ReportStorageKey('p'), JSON.stringify(report));
  expect(recallGa4Report('p')).toEqual(report);
});
