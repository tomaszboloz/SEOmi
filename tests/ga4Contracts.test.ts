import { describe, expect, it, vi } from 'vitest';
import { parseGa4Discovery, parseGa4Report, parseGa4Snapshot, validateGa4DateRange } from '@/services/ga4/contracts';
import { connectGoogleAnalytics, fetchGoogleAnalyticsPerformance, listGoogleAnalyticsProperties } from '@/services/ga4/transport';

const property = { name: 'properties/123', display_name: 'Site', stream_urls: ['https://site.test/'] };
const discovery = { status: 'complete', property, account_pages: 1, stream_pages: 1, candidates_checked: 1, may_be_truncated: false };
const report = { status: 'complete', property: 'properties/123', host_name: 'site.test', start_date: '2026-09-01', end_date: '2026-09-30', rows: [{ host_name: 'site.test', landing_page: '/home?x=1', sessions: 3, engaged_sessions: 2, key_events: 1 }], row_count: 1, pages: 1, may_be_truncated: false };

describe('GA4 contracts', () => {
  it('accepts native discovery and preserves explicit property metadata', () => {
    expect(parseGa4Discovery(discovery)).toEqual(discovery);
    expect(parseGa4Discovery({ ...discovery, property: null }).property).toBeNull();
  });

  it('rejects malformed metrics, counters and discovery status', () => {
    expect(() => parseGa4Report({ ...report, rows: [{ ...report.rows[0], sessions: -1 }] })).toThrow(/sessions/);
    expect(() => parseGa4Discovery({ ...discovery, candidates_checked: 1.5 })).toThrow(/candidate/);
    expect(() => parseGa4Discovery({ ...discovery, status: 'unknown' })).toThrow(/status/);
  });

  it('requires valid ordered ISO dates', () => {
    expect(validateGa4DateRange({ startDate: '2026-09-01', endDate: '2026-09-30' })).toBeNull();
    expect(validateGa4DateRange({ startDate: '2026-10-01', endDate: '2026-09-30' })).toContain('invalid');
    expect(() => parseGa4Snapshot({ status: 'complete', start_date: '2026-09-01', end_date: '2026-09-30', discovery, report: { ...report, end_date: '2026-09-29' } })).toThrow(/period/);
  });

  it('uses the explicit GA4 IPC names and site scope', async () => {
    const invoke = vi.fn().mockResolvedValueOnce(discovery).mockResolvedValueOnce({ status: 'missing', start_date: '2026-09-01', end_date: '2026-09-30', discovery, report: null }).mockResolvedValueOnce({ ok: true });
    await expect(listGoogleAnalyticsProperties({ projectId: 'p1', clientId: 'c1', siteUrl: 'https://site.test/' }, invoke)).resolves.toEqual(discovery);
    await expect(fetchGoogleAnalyticsPerformance({ projectId: 'p1', clientId: 'c1', siteUrl: 'https://site.test/', startDate: '2026-09-01', endDate: '2026-09-30' }, invoke)).resolves.toMatchObject({ report: null });
    await connectGoogleAnalytics({ projectId: 'p1', clientId: 'c1', clientSecret: 'secret' }, invoke);
    expect(invoke.mock.calls.map(([name, args]) => [name, args])).toEqual([
      ['list_google_analytics_properties', { projectId: 'p1', clientId: 'c1', siteUrl: 'https://site.test/' }],
      ['google_analytics_performance', { projectId: 'p1', clientId: 'c1', siteUrl: 'https://site.test/', startDate: '2026-09-01', endDate: '2026-09-30' }],
      ['connect_google_analytics', { projectId: 'p1', clientId: 'c1', clientSecret: 'secret' }],
    ]);
  });
});
