import { describe, expect, it } from 'vitest';
import { parseGa4Report } from '@/services/ga4/contracts';

const row = {
  host_name: 'site.test',
  landing_page: '/home?x=1',
  sessions: 3,
  engaged_sessions: 2,
  key_events: 1,
};
const report = {
  status: 'complete',
  property: 'properties/123',
  host_name: 'site.test',
  start_date: '2026-09-01',
  end_date: '2026-09-30',
  rows: [row],
  row_count: 1,
  pages: 1,
  may_be_truncated: false,
};

describe('GA4 contract report branches', () => {
  it('accepts optional report fields and rejects malformed envelopes', () => {
    expect(parseGa4Report(report)).toEqual(report);
    const sparse = parseGa4Report({
      ...report,
      status: undefined,
      host_name: ' ',
      pages: -1,
      row_count: null,
      rows: [],
    });
    expect(sparse).not.toHaveProperty('status');
    expect(sparse).not.toHaveProperty('host_name');
    expect(sparse).not.toHaveProperty('pages');
    expect(sparse.row_count).toBeNull();
    for (const raw of [null, [], {}, { ...report, rows: null }, { ...report, may_be_truncated: undefined }]) {
      expect(() => parseGa4Report(raw)).toThrow(/report/);
    }
    expect(() => parseGa4Report({ ...report, start_date: undefined })).toThrow(/start date/);
    expect(() => parseGa4Report({ ...report, end_date: '2026-02-30' })).toThrow(/date range/);
    const missingRowCount = { ...report } as { row_count?: unknown };
    delete missingRowCount.row_count;
    expect(() => parseGa4Report(missingRowCount)).toThrow(/row count/);
    expect(() => parseGa4Report({ ...report, row_count: 1.5 })).toThrow(/row count/);
    expect(() => parseGa4Report({ ...report, row_count: -1 })).toThrow(/row count/);
    expect(() => parseGa4Report({ ...report, status: 'unknown' })).toThrow(/status/);
    expect(parseGa4Report({ ...report, host_name: ' site.test ', pages: 2 }).host_name).toBe('site.test');
    expect(() => parseGa4Report({ ...report, pages: 1.5 })).not.toThrow();
  });

  it('rejects malformed rows and exercises every metric validator branch', () => {
    expect(() => parseGa4Report({ ...report, rows: [null] })).toThrow(/report row/);
    expect(() => parseGa4Report({ ...report, rows: [{ ...row, host_name: ' ' }] })).toThrow(/report host/);
    expect(() => parseGa4Report({ ...report, rows: [{ ...row, landing_page: undefined }] })).toThrow(/landing page/);
    expect(() => parseGa4Report({ ...report, rows: [{ ...row, sessions: '3' }] })).toThrow(/sessions/);
    expect(() => parseGa4Report({ ...report, rows: [{ ...row, engaged_sessions: Number.NaN }] })).toThrow(/engaged sessions/);
    expect(() => parseGa4Report({ ...report, rows: [{ ...row, key_events: -1 }] })).toThrow(/key events/);
    expect(() => parseGa4Report({ ...report, rows: [{ ...row, key_events: Number.POSITIVE_INFINITY }] })).toThrow(/key events/);
  });
});
