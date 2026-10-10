import { beforeEach, describe, expect, it, vi } from 'vitest';
import { findCrawlDiffCollisions } from '@/services/crawlDiff/collisions';
import { googleSuggestionsFeedUrl } from '@/services/freeSuggestions';
import { parseGoogleSuggestionsResponse } from '@/services/freeSuggestions/parser';
import { semanticPageTermInventory } from '@/services/semanticText';
import { comparePageSpeedForMonitoring } from '@/services/monitoringAlerts/evaluators';
import {
  alertFingerprint, frequencyWindowMs, monitorCrawlComparison, monitorGscSnapshots,
  monitorPageSpeedSnapshots, monitorSemanticComparison, monitoringSettingsKey,
  readMonitoringSettings, saveMonitoringSettings, validAlert, validMonitoringProject,
} from '@/services/monitoringAlerts';
import type { GscPerformanceSnapshot } from '@/services/gscPerformanceTracker';
import type { PageSpeedSnapshot } from '@/services/pagespeedHistory';

const send = vi.hoisted(() => vi.fn());
vi.mock('@/services/desktopNotifications/delivery', () => ({ sendProjectNotification: send }));

const gsc = (id: string, clicks: number, impressions: number, start_date = '2026-01-01', end_date = '2026-01-07'): GscPerformanceSnapshot => ({
  id, captured_at: '2026-01-31T00:00:00Z', site_url: 'sc-domain:example.test', start_date, end_date, filters: {},
  total_clicks: clicks, total_impressions: impressions, avg_ctr: clicks / impressions, avg_position: 5,
  queries: [{ query: 'seo', clicks, impressions, ctr: clicks / impressions, position: 5 }], pages: [],
  queries_may_be_truncated: false, pages_may_be_truncated: false, max_rows_per_dimension: 250, stored_query_rows: 1, stored_page_rows: 0,
});
const psi = (id: string, performance: number, capturedAt = '2026-01-08T00:00:00Z'): PageSpeedSnapshot => ({
  id, capturedAt, url: 'https://example.test/', strategy: 'mobile', formFactor: 'PHONE', scope: 'url',
  pageSpeed: { source: 'fixture', requestedUrl: 'https://example.test/', finalUrl: 'https://example.test/', strategy: 'mobile', fetchedAt: '2026-01-08T00:00:00Z', lighthouseVersion: null, categories: { performance, accessibility: .9, bestPractices: .9, seo: .9 }, metrics: {}, opportunities: [], fieldExperience: null, originExperience: null }, crux: null,
});
const settings = { enabled: true, frequency: 'run' as const, types: { gsc: true, pagespeed: true, crawl: true, semantic: true }, thresholds: { gsc: { declinePercent: 20, minImpressions: 1 }, pagespeed: { categoryDrop: .1, metricIncrease: 250, maxWindowDays: 35 }, crawl: { changedPages: 1 }, semantic: { changes: 1 } } };
const crawl = (type: 'comparable' | 'partial' = 'comparable') => ({ status: type, reasons: [], added: [{ kind: 'added', url: 'https://example.test/new', fields: [] }], removed: [], changed: [], provenance: { current: { runId: 'current' } } } as any);
const semantic = () => ({ currentRunId: 'current', changes: [{ id: 'change' }], truncated: false, guard: { status: 'comparable' } } as any);

describe('direct public callable assertions', () => {
  beforeEach(() => { localStorage.clear(); send.mockReset().mockResolvedValue(true); });

  it('preserves collision diagnostics and bounded semantic inventory', () => {
    const collisions = findCrawlDiffCollisions([{ url: 'https://example.test/a' }, { url: 'https://example.test/a' }, { url: '' }] as any, (url) => new URL(url).pathname, 'current');
    expect(collisions).toEqual([{ key: '', side: 'current', urls: [], invalid: true }, { key: '/a', side: 'current', urls: ['https://example.test/a', 'https://example.test/a'] }]);
    const inventory = semanticPageTermInventory({ http_status: 200, semantic_language: 'pl', semantic_terms: ['Szkolenia', 'szkolenie', 'SEO', 'ale'] });
    expect([...inventory.values()]).toEqual(['szkolenia', 'seo']);
  });

  it('parses a public suggestions response while retaining source evidence', () => {
    const request = { feed: 'google-suggestions' as const, geo: 'PL', keyword: 'seo', language: 'pl' };
    const result = parseGoogleSuggestionsResponse({ status: 'ok', sourceUrl: googleSuggestionsFeedUrl('seo', 'PL', 'pl'), fetchedAt: '2026-10-08T10:00:00Z', body: JSON.stringify(['seo', ['SEO audit', 'SEO audit']]), httpStatus: 200, error: null }, request);
    expect(result.suggestions).toEqual(['SEO audit']);
    expect(result.source.requestedGeo).toBe('PL');
  });

  it('asserts monitoring policy helpers and page speed comparison output', () => {
    expect(monitoringSettingsKey('project-1')).toContain('project-1');
    expect(validMonitoringProject('project-1')).toBe(true);
    expect(validMonitoringProject('')).toBe(false);
    expect(alertFingerprint('gsc', ' source ', { b: 2, a: 1 })).toBe(alertFingerprint('gsc', ' source ', { a: 1, b: 2 }));
    expect(frequencyWindowMs('weekly')).toBe(7 * 86_400_000);
    const alert = { type: 'gsc', fingerprint: 'f', sourceId: 's', title: 'title', body: 'body', occurredAt: '2026-10-08T10:00:00Z' };
    expect(validAlert(alert)).toBe(true);
    expect(validAlert({ ...alert, type: 'unknown' })).toBe(false);
    expect(comparePageSpeedForMonitoring(psi('old', .8), psi('new', .5, '2026-01-09T00:00:00Z'), settings)?.type).toBe('pagespeed');
  });

  it('runs every monitoring facade through delivery and persisted evidence', async () => {
    for (const project of ['gsc-project', 'psi-project', 'crawl-project', 'semantic-project']) expect(saveMonitoringSettings(project, settings)).toBe(true);
    const gscResult = await monitorGscSnapshots('gsc-project', gsc('old', 100, 100), gsc('new', 40, 100, '2026-02-01', '2026-02-07'));
    const psiResult = await monitorPageSpeedSnapshots('psi-project', psi('old', .8), psi('new', .5, '2026-01-09T00:00:00Z'));
    const crawlResult = await monitorCrawlComparison('crawl-project', crawl());
    const semanticResult = await monitorSemanticComparison('semantic-project', semantic());
    expect([gscResult, psiResult, crawlResult, semanticResult].map((result) => result.alert?.type)).toEqual(['gsc', 'pagespeed', 'crawl', 'semantic']);
    expect([gscResult, psiResult, crawlResult, semanticResult].every((result) => result.delivered && result.persisted)).toBe(true);
    expect(readMonitoringSettings('gsc-project').enabled).toBe(true);
    expect(send).toHaveBeenCalledTimes(4);
  });
});
