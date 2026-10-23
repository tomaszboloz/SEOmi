import { afterEach, describe, expect, it } from 'vitest';
import { buildUrlTelemetrySnapshot, clearSnapshots, getSnapshot, periodDays, putSnapshot, windowState } from '@/services/urlTelemetry';
import { scopeOf, urlKey } from '@/services/urlTelemetry/urlKey';
import type { BacklinkProfileData, GscPerformanceData } from '@/types';
import type { Ga4Report } from '@/types/ga4';

const now = new Date('2026-10-23T00:00:00Z');
const gsc = (over: Partial<GscPerformanceData> = {}): GscPerformanceData => ({
  site_url: 'https://a.com/', start_date: '2026-07-25', end_date: '2026-10-22', total_clicks: 0, total_impressions: 0, avg_ctr: 0, avg_position: 0,
  queries: [], pages: [{ page: 'https://a.com/x/', clicks: 5, impressions: 50, ctr: 0.1, position: 3 }, { page: 'https://a.com/x', clicks: 1, impressions: 5, ctr: 0.1, position: 4 },
    { page: 'https://other.com/y', clicks: 9, impressions: 9, ctr: 1, position: 1 }, { page: 'https://a.com/bad', clicks: NaN, impressions: 1, ctr: 0, position: 1 }],
  query_pages: [{ query: 'q1', page: 'https://a.com/x', clicks: 1, impressions: 1, ctr: 1, position: 1 }, { query: 'q2', page: 'https://a.com/x', clicks: 1, impressions: 1, ctr: 1, position: 1 },
    { query: 'q', page: 'https://zzz.com/', clicks: 1, impressions: 1, ctr: 1, position: 1 }],
  daily: [], daily_may_be_truncated: false, queries_may_be_truncated: false, pages_may_be_truncated: false, max_rows_per_dimension: 25000, ...over,
});
const ga4 = (over: Partial<Ga4Report> = {}): Ga4Report => ({
  property: 'properties/1', start_date: '2026-07-25', end_date: '2026-10-22', may_be_truncated: false, row_count: 2,
  rows: [{ host_name: 'a.com', landing_page: '/x', sessions: 3, engaged_sessions: 2, key_events: 1 }, { host_name: 'a.com', landing_page: '/x/', sessions: 1, engaged_sessions: 1, key_events: 0 }, { host_name: 'b.com', landing_page: '/q', sessions: 1, engaged_sessions: 1, key_events: 0 }], ...over,
});
const links = { domain: 'a.com', total_backlinks: 4, referring_domains: 2, backlinks: [
  { source_url: 'https://www.r.com/1', target_url: 'https://a.com/x' }, { source_url: 'https://r.com/2', target_url: 'https://a.com/x' }, { source_url: 'bad', target_url: 'https://a.com/x' }, { source_url: 'https://s.com', target_url: 'https://a.com/z' },
] } as unknown as BacklinkProfileData;
const base = { projectId: 'p', rootUrl: 'https://a.com/', urls: ['https://a.com/x', '/empty', 'mailto:x', 'https://a.com/z'], now };

afterEach(() => clearSnapshots());

describe('urlKey', () => {
  it('normalizes and rejects other origins', () => {
    const scope = scopeOf('https://A.com./')!;
    expect(urlKey('/p/?a=1', 'https://a.com/', scope)).toBe('https://a.com/p?a=1');
    expect(urlKey('https://a.com:8080/', 'https://a.com/', scope)).toBeNull();
    expect(urlKey('http://', 'https://a.com/', scope)).toBeNull();
    expect(urlKey('/old', 'https://a.com/', scope, { 'https://a.com/old': 'https://a.com/new' })).toBe('https://a.com/new');
    expect(urlKey('/old', 'https://a.com/', scope, { 'https://a.com/old': 'https://x.com/new' })).toBe('https://a.com/old');
  });
  it('rejects unusable scopes', () => {
    expect(scopeOf('')).toBeNull();
    expect(scopeOf('ftp://a.com')).toBeNull();
    expect(scopeOf('https://u:p@a.com')).toBeNull();
    expect(scopeOf('nope')).toBeNull();
    expect(scopeOf('http://a.com:81')?.origin).toBe('http://a.com:81');
  });
});

describe('window state', () => {
  it('classifies freshness and length', () => {
    expect(periodDays('2026-07-25', '2026-10-22')).toBe(90);
    expect(periodDays('bad', '2026-10-22')).toBe(0);
    expect(windowState('2026-07-25', '2026-10-22', now)).toBe('measured');
    expect(windowState('2026-09-01', '2026-10-22', now)).toBe('partial-history');
    expect(windowState('2026-07-25', '2026-09-01', now)).toBe('stale');
    expect(windowState('x', 'y', now)).toBe('unavailable');
  });
});

describe('snapshot', () => {
  it('returns null for unusable root', () => expect(buildUrlTelemetrySnapshot({ ...base, rootUrl: 'x' })).toBeNull());
  it('joins three sources per URL and keeps unknown separate from zero', () => {
    const s = buildUrlTelemetrySnapshot({ ...base, gsc: gsc(), ga4: ga4(), backlinks: links, backlinkProvider: 'moz', backlinkRetrievedAt: '2026-10-01' })!;
    const x = s.urls.find((u) => u.url === 'https://a.com/x')!;
    expect(x.gsc.value).toMatchObject({ clicks: 6, impressions: 55, position: null, observedQueryCount: 2, queryCountTruncated: false });
    expect(x.ga4.value).toEqual({ sessions: 4, engagedSessions: 3, keyEvents: 1 });
    expect(x.backlinks.value).toEqual({ referringDomains: 1 });
    expect(x.revenue.state).toBe('unavailable');
    const empty = s.urls.find((u) => u.url === 'https://a.com/empty')!;
    expect(empty.gsc.value).toMatchObject({ clicks: 0 });
    expect(empty.ga4.value).toMatchObject({ sessions: 0 });
    expect(empty.backlinks.value).toBeNull();
    expect(s.sources.backlinks).toMatchObject({ provider: 'moz', retrievedAt: '2026-10-01', coveragePct: 100 });
    expect(s.sources.gsc.searchType).toBe('web');
    expect(s.urls.some((u) => u.url.includes('other.com'))).toBe(false);
    expect(Object.isFrozen(s)).toBe(true);
  });
  it('reports missing permission, unavailable and sampled states', () => {
    const none = buildUrlTelemetrySnapshot({ ...base, gscFailure: 'permission', ga4Failure: 'unavailable' })!;
    expect(none.sources.gsc.state).toBe('missing-permission');
    expect(none.urls[0].gsc).toMatchObject({ state: 'missing-permission', value: null });
    expect(none.urls[0].ga4.state).toBe('unavailable');
    expect(none.sources.ga4.state).toBe('unavailable');
    expect(buildUrlTelemetrySnapshot({ ...base, ga4Failure: 'permission' })!.sources.ga4.state).toBe('missing-permission');
    const trunc = buildUrlTelemetrySnapshot({ ...base, gsc: gsc({ pages_may_be_truncated: true, query_pages: undefined }), ga4: ga4({ may_be_truncated: true }), backlinks: { ...links, total_backlinks: 40 } })!;
    expect(trunc.urls.find((u) => u.url.endsWith('/empty'))!.gsc.state).toBe('sampled');
    expect(trunc.urls.find((u) => u.url.endsWith('/x'))!.gsc.value?.queryCountTruncated).toBe(true);
    expect(trunc.urls.find((u) => u.url.endsWith('/x'))!.gsc.value?.observedQueryCount).toBeNull();
    expect(trunc.urls.find((u) => u.url.endsWith('/empty'))!.ga4.state).toBe('sampled');
    expect(trunc.urls.find((u) => u.url.endsWith('/empty'))!.backlinks.state).toBe('sampled');
  });
  it('flags partial, stale and zero-link profiles', () => {
    const partial = buildUrlTelemetrySnapshot({ ...base, gsc: gsc({ start_date: '2026-10-01' }), backlinks: { ...links, total_backlinks: 0 } })!;
    expect(partial.sources.gsc.state).toBe('partial-history');
    expect(partial.urls.find((u) => u.url.endsWith('/empty'))!.gsc.state).toBe('partial-history');
    expect(partial.sources.backlinks.coveragePct).toBeNull();
    expect(buildUrlTelemetrySnapshot({ ...base, backlinks: links })!.sources.backlinks.provider).toBe('unknown');
    expect(buildUrlTelemetrySnapshot({ ...base, backlinks: links })!.urls.find((u) => u.url.endsWith('/empty'))!.backlinks.state).toBe('unavailable');
  });
  it('stores per project with expiry', () => {
    const s = buildUrlTelemetrySnapshot({ ...base, ttlMs: 1000 })!;
    putSnapshot(s);
    expect(getSnapshot('p', now)).toBe(s);
    expect(getSnapshot('q', now)).toBeNull();
    expect(getSnapshot('p', new Date(now.getTime() + 5000))).toBeNull();
    expect(getSnapshot('p', now)).toBeNull();
  });
  it('uses default ttl and clock', () => {
    const s = buildUrlTelemetrySnapshot({ projectId: 'p', rootUrl: 'https://a.com/', urls: [] })!;
    expect(Date.parse(s.expiresAt) - Date.parse(s.createdAt)).toBe(86_400_000);
  });
});
