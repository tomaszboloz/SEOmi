import { describe, expect, it } from 'vitest';
import { comparePageSpeedForMonitoring, evaluateCrawlAlert, evaluateGscAlert, evaluatePageSpeedAlert, evaluateSemanticAlert, guardPageSpeedComparison } from '@/services/monitoringAlerts/evaluators';
import type { GscPerformanceSnapshot, GscSnapshotComparison } from '@/services/gscPerformanceTracker';
import type { PageSpeedSnapshot, PageSpeedComparison } from '@/services/pagespeedHistory';
import type { CrawlDiffReport } from '@/services/crawlDiff';
import type { SemanticRunComparisonReport } from '@/services/semanticRunComparison';

const makeGsc = (overrides: Partial<GscPerformanceSnapshot> = {}): GscPerformanceSnapshot => ({
  id: 'gsc-base', captured_at: '2026-01-31T00:00:00Z', site_url: 'sc-domain:example.test', start_date: '2026-01-01', end_date: '2026-01-07', filters: {}, total_clicks: 100, total_impressions: 1000, avg_ctr: 0.1, avg_position: 5, queries: [], pages: [], queries_may_be_truncated: false, pages_may_be_truncated: false, max_rows_per_dimension: 250, stored_query_rows: 0, stored_page_rows: 0, ...overrides,
});

const makePsi = (overrides: Partial<PageSpeedSnapshot> = {}): PageSpeedSnapshot => ({
  id: 'psi-base', capturedAt: '2026-01-01T00:00:00Z', url: 'https://example.test/', strategy: 'mobile', formFactor: 'PHONE', scope: 'url',
  pageSpeed: {
    source: 'fixture', requestedUrl: 'https://example.test/', finalUrl: 'https://example.test/', strategy: 'mobile', fetchedAt: '2026-01-01T00:00:00Z', lighthouseVersion: null,
    categories: { performance: 0.9, accessibility: 0.9, bestPractices: 0.9, seo: 0.9 }, metrics: { 'largest-contentful-paint': { numericValue: 1000 } }, opportunities: [], fieldExperience: null, originExperience: null,
  },
  crux: null, ...overrides,
});

describe('guardPageSpeedComparison branch coverage', () => {
  it('handles invalid urls and normalizes urls with hashes and trailing slashes', () => {
    const baseline = makePsi({ url: 'not-a-valid-url' });
    const current = makePsi({ url: 'different-invalid-url', capturedAt: '2026-01-05T00:00:00Z' });
    expect(guardPageSpeedComparison(baseline, current, 35).reasons).toContain('different-url');
    const bHash = makePsi({ url: 'https://example.test/path/#section' });
    const cSlash = makePsi({ url: 'https://example.test/path/', capturedAt: '2026-01-05T00:00:00Z' });
    expect(guardPageSpeedComparison(bHash, cSlash, 35).reasons).not.toContain('different-url');
  });

  it('rejects invalid or non-advancing time windows', () => {
    const valid = makePsi({ capturedAt: '2026-01-05T00:00:00Z' });
    expect(guardPageSpeedComparison(makePsi({ capturedAt: 'bad-date' }), valid, 35).reasons).toContain('invalid-time-window');
    expect(guardPageSpeedComparison(valid, makePsi({ capturedAt: 'bad-date' }), 35).reasons).toContain('invalid-time-window');
    expect(guardPageSpeedComparison(valid, makePsi({ capturedAt: '2026-01-05T00:00:00Z' }), 35).reasons).toContain('invalid-time-window');
  });

  it('detects mismatched strategy, formFactor, scope and crux scope', () => {
    const base = makePsi();
    const future = '2026-01-05T00:00:00Z';
    expect(guardPageSpeedComparison(base, makePsi({ strategy: 'desktop', capturedAt: future }), 35).reasons).toContain('different-scope');
    expect(guardPageSpeedComparison(base, makePsi({ formFactor: 'DESKTOP', capturedAt: future }), 35).reasons).toContain('different-scope');
    expect(guardPageSpeedComparison(base, makePsi({ scope: 'origin', capturedAt: future }), 35).reasons).toContain('different-scope');
    const crux1 = { source: 'fixture', fetchedAt: '2026-01-01', target: 'https://example.test/', scope: 'url', formFactor: 'PHONE' as const, response: {} };
    const baseWithCrux = makePsi({ crux: crux1 });
    expect(guardPageSpeedComparison(baseWithCrux, makePsi({ capturedAt: future, crux: { ...crux1, target: 'https://other.test/' } }), 35).reasons).toContain('different-crux-scope');
    expect(guardPageSpeedComparison(baseWithCrux, makePsi({ capturedAt: future, crux: { ...crux1, scope: 'origin' } }), 35).reasons).toContain('different-crux-scope');
    expect(guardPageSpeedComparison(baseWithCrux, makePsi({ capturedAt: future, crux: { ...crux1, formFactor: 'DESKTOP' } }), 35).reasons).toContain('different-crux-scope');
  });

  it('blocks comparison when neither pageSpeed nor crux are both present', () => {
    const psiOnly = makePsi({ capturedAt: '2026-01-01T00:00:00Z', crux: null });
    const cruxOnly = makePsi({ capturedAt: '2026-01-05T00:00:00Z', pageSpeed: null, crux: { source: 'f', fetchedAt: 'x', target: 'https://example.test/', scope: 'url', formFactor: 'PHONE', response: {} } });
    expect(guardPageSpeedComparison(psiOnly, cruxOnly, 35).reasons).toContain('missing-comparable-report');
    expect(guardPageSpeedComparison(makePsi({ pageSpeed: null }), makePsi({ pageSpeed: null, capturedAt: '2026-01-05T00:00:00Z' }), 35).reasons).toContain('missing-comparable-report');
  });
});

describe('evaluatePageSpeedAlert and comparePageSpeedForMonitoring', () => {
  it('returns null when there are no regressions or comparison is blocked', () => {
    const baseline = makePsi({ capturedAt: '2026-01-01T00:00:00Z' });
    const current = makePsi({ capturedAt: '2026-01-05T00:00:00Z' });
    const cleanComparison: PageSpeedComparison = {
      baseline, current,
      categoryDeltas: [{ key: 'performance', baseline: 0.9, current: 0.95, delta: 0.05 }],
      metricDeltas: [{ id: 'largest-contentful-paint', baseline: 1000, current: 900, delta: -100 }],
      cruxDeltas: [{ id: 'cumulative_layout_shift', baseline: 0.05, current: 0.05, delta: 0 }],
    };
    expect(evaluatePageSpeedAlert(baseline, current, cleanComparison)).toBeNull();
  });

  it('flags lab metric regressions and CLS crux regressions with threshold distinctions', () => {
    const baseline = makePsi({ capturedAt: '2026-01-01T00:00:00Z' });
    const current = makePsi({ id: 'psi-regressed', capturedAt: '2026-01-05T00:00:00Z' });
    const regressionComparison: PageSpeedComparison = {
      baseline, current,
      categoryDeltas: [{ key: 'performance', baseline: 0.9, current: 0.9, delta: 0 }],
      metricDeltas: [
        { id: 'first-contentful-paint', baseline: 1000, current: 1300, delta: 300 },
        { id: 'speed-index', baseline: null, current: 1200, delta: null },
      ],
      cruxDeltas: [
        { id: 'cumulative_layout_shift', baseline: 0.05, current: 0.2, delta: 0.15 },
        { id: 'largest_contentful_paint', baseline: 1000, current: 1100, delta: 100 },
      ],
    };
    const alert = evaluatePageSpeedAlert(baseline, current, regressionComparison);
    expect(alert?.type).toBe('pagespeed');
    expect(alert?.evidence.metrics).toBe(1);
    expect(alert?.evidence.crux).toBe(1);
    expect(comparePageSpeedForMonitoring(baseline, current)).toBeNull();
  });
});

describe('evaluateGscAlert and compareGscForMonitoring branches', () => {
  it('handles pageChanges decline, slice key cap, and incompatible comparison', () => {
    const baseline = makeGsc();
    const current = makeGsc({ id: 'gsc-curr' });
    const incompatible: GscSnapshotComparison = { compatible: false, reasons: ['different-domain'], baseline, current, queryChanges: [], pageChanges: [], newQueries: [], lostQueries: [], newPages: [], lostPages: [], uncertainBecauseTruncated: false };
    expect(evaluateGscAlert(baseline, current, incompatible)).toBeNull();

    const tenPageChanges = Array.from({ length: 10 }, (_, i) => ({
      key: `https://example.test/p${i}`,
      baseline: { clicks: 50, impressions: 200, ctr: 0.25, position: 2 },
      current: { clicks: 10, impressions: 50, ctr: 0.2, position: 8 },
      clicksDelta: -40, impressionsDelta: -150, clicksDeltaPercent: null, impressionsDeltaPercent: -75,
    }));
    const comparisonWithPages: GscSnapshotComparison = {
      compatible: true, reasons: [], baseline, current, queryChanges: [], pageChanges: tenPageChanges,
      newQueries: [], lostQueries: [], newPages: [], lostPages: [], uncertainBecauseTruncated: false,
    };
    const alert = evaluateGscAlert(baseline, current, comparisonWithPages);
    expect(alert?.evidence.rows).toBe(10);
    expect(alert?.body).toContain('10 observed Search Console row(s)');
    expect(alert?.body.split(',').length).toBe(8);
  });
});

describe('evaluateCrawlAlert and evaluateSemanticAlert branches', () => {
  const crawlReport = (status: CrawlDiffReport['status'], changedCount: number): CrawlDiffReport => ({
    status, reasons: [], added: [], removed: [],
    changed: Array.from({ length: changedCount }, (_, i) => ({ kind: 'changed', url: `https://example.test/${i}`, fields: ['title'] })),
    provenance: { source: 'stored-crawl-runs', scopeMatched: true, baseline: { runId: 'r1', completedAt: '2026-01-01', startUrl: 'https://example.test/', scopeFingerprint: 's', pageCount: 1, completeness: 'complete', partial: false, partialReasons: [], provenance: 'stored-crawl-run' }, current: { runId: 'r2', completedAt: '2026-01-02', startUrl: 'https://example.test/', scopeFingerprint: 's', pageCount: 1, completeness: 'complete', partial: false, partialReasons: [], provenance: 'stored-crawl-run' } },
  });

  it('suppresses crawl alert when changes are below threshold and distinguishes comparable status', () => {
    expect(evaluateCrawlAlert(crawlReport('comparable', 0))).toBeNull();
    const comparableAlert = evaluateCrawlAlert(crawlReport('comparable', 2));
    expect(comparableAlert?.partial).toBe(false);
    expect(comparableAlert?.body).not.toContain('in a partial snapshot');
  });

  it('suppresses semantic alert when changes are below threshold', () => {
    const report: SemanticRunComparisonReport = {
      baselineRunId: 'r1', currentRunId: 'r2', changes: [],
      counts: { 'url-added': 0, 'url-not-observed': 0, 'content-terms-changed': 0, 'content-link-added': 0, 'content-link-not-observed': 0, 'topic-edge-added': 0, 'topic-edge-not-observed': 0, 'topic-url-coverage-changed': 0, 'query-term-observation-changed': 0 },
      truncated: false,
      guard: { status: 'comparable', reasons: [], provenance: { source: 'stored-crawl-runs', scopeMatched: true, baseline: { runId: 'r1', completedAt: '2026-01-01', startUrl: 'https://example.test/', scopeFingerprint: 's', pageCount: 1, completeness: 'complete', partial: false, partialReasons: [], provenance: 'stored-crawl-run' }, current: { runId: 'r2', completedAt: '2026-01-02', startUrl: 'https://example.test/', scopeFingerprint: 's', pageCount: 1, completeness: 'complete', partial: false, partialReasons: [], provenance: 'stored-crawl-run' } } },
    };
    expect(evaluateSemanticAlert(report)).toBeNull();
  });
});
