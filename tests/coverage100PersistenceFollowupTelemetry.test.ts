import { afterEach, expect, it, vi } from 'vitest';
import { decideProtection } from '@/services/urlProtection/decide';
import { gscMeasures } from '@/services/urlTelemetry/gscSource';
import { ga4Measures } from '@/services/urlTelemetry/otherSources';
import { measured } from '@/services/urlTelemetry/measure';
import { scopeOf, urlKey } from '@/services/urlTelemetry/urlKey';
import type { GscPerformanceData } from '@/types';
import type { Ga4Report } from '@/types/ga4';

const scope = scopeOf('https://site.test/')!;
const context = { scope, base: 'https://site.test/', now: new Date('2026-10-23T00:00:00Z') };

afterEach(() => vi.unstubAllGlobals());

it('keeps absent joint query rows at zero and normalizes the root path', () => {
  const data = {
    site_url: 'https://site.test/', start_date: '2026-10-01', end_date: '2026-10-22',
    total_clicks: 1, total_impressions: 2, avg_ctr: 0.5, avg_position: 2,
    queries: [], query_pages: [], pages: [{ page: 'https://site.test/page', clicks: 1, impressions: 2, ctr: 0.5, position: 2 }],
    daily: [], daily_may_be_truncated: false, queries_may_be_truncated: false, pages_may_be_truncated: false, max_rows_per_dimension: 10,
  } satisfies GscPerformanceData;
  expect(gscMeasures(data, { state: 'measured' }, context).get('https://site.test/page')?.value).toMatchObject({ observedQueryCount: 0 });
  expect(urlKey('/', context.base, scope)).toBe('https://site.test/');
});

it('includes a GA4 port when building the URL base', () => {
  const portScope = scopeOf('https://site.test:8443/')!;
  const report = { property: 'properties/1', start_date: '2026-10-01', end_date: '2026-10-22', rows: [{ host_name: 'site.test', landing_page: '/page', sessions: 1, engaged_sessions: 1, key_events: 0 }], may_be_truncated: false, row_count: 1 } satisfies Ga4Report;
  expect(ga4Measures(report, { state: 'measured' }, { ...context, scope: portScope, base: portScope.origin + '/' }).has('https://site.test:8443/page')).toBe(true);
});

it('preserves an optional measurement note and accepts valid protection thresholds', () => {
  expect(measured({ value: 1 }, 'measured', 'source note')).toEqual({ state: 'measured', value: { value: 1 }, note: 'source note' });
  const telemetry = {
    url: 'https://site.test/page',
    gsc: measured({ clicks: 0, impressions: 0, position: null, observedQueryCount: 0, queryCountTruncated: false }),
    ga4: measured({ sessions: 0, engagedSessions: 0, keyEvents: 0 }),
    backlinks: measured({ referringDomains: 0 }), revenue: measured({ amount: 0, currency: 'USD' }),
  };
  expect(decideProtection(0, telemetry, { trsThreshold: 1, priThreshold: 0.5 }).decision).toBe('prune-candidate');
});

it('normalizes a path made only of trailing slashes', () => {
  class SlashUrl {
    protocol = 'https:'; username = ''; password = ''; hostname = 'site.test'; port = '';
    origin = 'https://site.test'; pathname = '////'; search = ''; href = 'https://site.test/';
    constructor(_value: string, _base?: string) {}
  }
  vi.stubGlobal('URL', SlashUrl as unknown as typeof URL);
  expect(urlKey('/slashes', context.base, scope)).toBe('https://site.test/');
});
