import { describe, expect, it } from 'vitest';
import { parseGa4Snapshot } from '@/services/ga4/contracts';

const property = { name: 'properties/123', display_name: 'Site', stream_urls: ['https://site.test/'] };
const discovery = {
  status: 'complete',
  property,
  account_pages: 1,
  stream_pages: 1,
  candidates_checked: 1,
  may_be_truncated: false,
};
const report = {
  status: 'complete',
  property: 'properties/123',
  start_date: '2026-09-01',
  end_date: '2026-09-30',
  rows: [],
  row_count: 0,
  may_be_truncated: false,
};
const snapshot = {
  status: 'complete',
  start_date: '2026-09-01',
  end_date: '2026-09-30',
  discovery,
  report,
};

describe('GA4 contract snapshot branches', () => {
  it('accepts matching and missing reports', () => {
    expect(parseGa4Snapshot(snapshot)).toEqual(snapshot);
    expect(parseGa4Snapshot({ ...snapshot, status: 'partial', report: null })).toMatchObject({
      status: 'partial',
      report: null,
    });
  });

  it('rejects malformed envelopes, dates and statuses', () => {
    for (const raw of [null, [], {}, { ...snapshot, report: undefined }]) {
      expect(() => parseGa4Snapshot(raw)).toThrow(/snapshot|report/);
    }
    expect(() => parseGa4Snapshot({ ...snapshot, start_date: undefined })).toThrow(/snapshot start date/);
    expect(() => parseGa4Snapshot({ ...snapshot, end_date: '2026-02-30' })).toThrow(/date range/);
    expect(() => parseGa4Snapshot({ ...snapshot, start_date: '2026-10-01' })).toThrow(/date range/);
    expect(() => parseGa4Snapshot({ ...snapshot, status: 'unknown' })).toThrow(/status/);
    expect(() => parseGa4Snapshot({ ...snapshot, report: { ...report, end_date: '2026-09-29' } })).toThrow(/period/);
  });

  it('propagates discovery and report validation errors', () => {
    expect(() => parseGa4Snapshot({ ...snapshot, discovery: null })).toThrow(/discovery/);
    expect(() => parseGa4Snapshot({ ...snapshot, report: { ...report, property: '' } })).toThrow(/property/);
  });
});
