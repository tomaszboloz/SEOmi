import { afterEach, describe, expect, it } from 'vitest';
import { crawlFocusSummary } from '@/services/export/focusSummary';
import { summarizeProtection } from '@/services/export/focusProtection';
import { buildSiteFocusReport } from '@/services/siteFocus';
import { protectionRows } from '@/services/urlProtection';
import { clearSnapshots, putSnapshot, type UrlTelemetrySnapshot } from '@/services/urlTelemetry';
import type { CrawlRunRecord } from '@/types';
import { diabetesSite } from './siteFocusFixtures';

const START = 'https://diabetes.test/';
afterEach(clearSnapshots);

const report = () => buildSiteFocusReport(diabetesSite(), START, { now: '2026-10-15T00:00:00Z' });
const lowUrls = () => report().pages.filter((page) => !page.skipped && page.trs < 40).map((page) => page.url);

const snapshot = (urls: string[]): UrlTelemetrySnapshot => ({
  id: 's', projectId: 'p1', origin: START, createdAt: '2026-10-15T00:00:00Z', expiresAt: '2999-01-01T00:00:00Z',
  sources: { gsc: { state: 'measured' }, ga4: { state: 'unavailable' }, backlinks: { state: 'measured' } },
  urls: urls.map((url, i) => ({
    url,
    gsc: { state: 'measured', value: { clicks: i === 0 ? 120 : 0, impressions: 10, position: 8, observedQueryCount: 1, queryCountTruncated: false } },
    ga4: { state: 'unavailable', value: null },
    backlinks: { state: 'measured', value: { referringDomains: 0 } },
    revenue: { state: 'unavailable', value: null },
  })),
});

describe('protection export (GEM-81-09)', () => {
  it('without telemetry every low-TRS page needs data and the PDF says no telemetry was used', () => {
    const summary = summarizeProtection(report(), null);
    expect(summary?.telemetry).toBe(false);
    expect(summary?.rows.length).toBe(lowUrls().length);
    expect(summary?.rows.every((row) => row.decision === 'needs-data')).toBe(true);
    expect(summary?.rows[0].evidence[0]).toEqual({ signal: 'clicks', state: 'unavailable', value: null });
    expect(summary).toMatchObject({ trs_threshold: 40, pri_threshold: 0.15 });
  });

  it('carries decisions, evidence and advice conditions from the shared snapshot', () => {
    putSnapshot(snapshot(lowUrls()));
    const summary = summarizeProtection(report(), 'p1');
    expect(summary?.telemetry).toBe(true);
    expect(summary?.rows[0]).toMatchObject({ decision: 'shield', reasons: ['pri-above-threshold'] });
    // GA4 unavailable: a zero-click page is not pruned, it needs data.
    expect(summary?.rows[1].decision).toBe('needs-data');
    expect(summary?.rows[1].advice[0]).toEqual({ code: 'check-gsc-ga4-backlinks-access', conditions: ['fresh-90-day-window'] });
  });

  it('is absent when no page is below the threshold and attached to the run summary otherwise', () => {
    const strong = { ...report(), pages: [] };
    expect(summarizeProtection(strong, null)).toBeUndefined();
    expect(protectionRows(strong, null).rows).toEqual([]);
    const run = { id: 'r', projectId: null, completedAt: '2026-10-15T10:00:00Z', startUrl: START, config: {}, result: { start_url: START, pages: diabetesSite(), resources: [] } } as unknown as CrawlRunRecord;
    expect(crawlFocusSummary(run)?.protection?.rows.length).toBe(lowUrls().length);
  });
});
