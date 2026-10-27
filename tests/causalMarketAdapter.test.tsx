import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import i18n from '@/i18n';
import { SignalsWorkspace } from '@/components/Charts/semanticTopical/signals/SignalsWorkspace';
import { buildCausalImpact, readStoredCausalImpact } from '@/services/causalMarket/adapter';
import { saveGscSnapshot } from '@/services/gscTracker/persistence';
import { snapshotGscPerformance } from '@/services/gscTracker/snapshot';
import { addIntervention } from '@/services/experiments/registry';
import type { GscPerformanceData } from '@/types';
import type { SemanticMap } from '@/services/semanticGraph/types';

const graph: SemanticMap = { nodes: [], edges: [], topicEdges: [], clusters: [], totalEdges: 0, totalTopicEdges: 0, totalInternalLinks: 0, hasSemanticTerms: false, truncated: false };
const dates = Array.from({ length: 28 }, (_, index) => `2026-03-${String(index + 1).padStart(2, '0')}`);
const intervention = { id: 'i1', projectId: 'p1', url: 'site' as const, date: '2026-03-15', kind: 'content' as const, note: '', createdAt: '2026-03-01T00:00:00.000Z' };

const data = (site_url: string, clicks: (index: number) => number, customDates = dates, filters?: GscPerformanceData['filters']): GscPerformanceData => {
  const daily = customDates.map((date, index) => ({ date, clicks: clicks(index), impressions: clicks(index) * 10, ctr: 0.1, position: 2 }));
  return { site_url, start_date: customDates[0], end_date: customDates.at(-1)!, total_clicks: daily.reduce((sum, row) => sum + row.clicks, 0), total_impressions: daily.reduce((sum, row) => sum + row.impressions, 0), avg_ctr: 0.1, avg_position: 2, queries: [], pages: [], daily, daily_may_be_truncated: false, queries_may_be_truncated: false, pages_may_be_truncated: false, max_rows_per_dimension: 1000, filters };
};

const evidence = { status: 'available' as const, source: 'saved-test-market', observations: dates.map((date) => ({ date, level: 100 })) };

beforeEach(async () => {
  localStorage.clear();
  await i18n.changeLanguage('en');
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    if (url.includes('dataforseo')) {
      const payload = dates.map((date) => ({ date: `${date}T00:00:00`, main_metric: { volatility: 100 } }));
      return { ok: true, json: async () => payload } as Response;
    }
    if (url.includes('status.search.google.com')) {
      return { ok: true, json: async () => [{ service_name: 'Ranking', begin: '2025-01-01T00:00:00Z', end: '2025-01-02T00:00:00Z' }] } as Response;
    }
    return { ok: false, status: 500, json: async () => ({}) } as Response;
  });
});
afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

describe('causal market stored adapter', () => {
  it('builds an impact from saved GSC series and deduplicates daily rows across snapshots', () => {
    const older = snapshotGscPerformance(data('https://site.test', () => 50), '2026-03-01T00:00:00.000Z');
    const newer = snapshotGscPerformance(data('https://site.test', (i) => i < 14 ? 50 : 65), '2026-03-02T00:00:00.000Z');
    const control = snapshotGscPerformance(data('https://control.test', () => 100, dates, { search_type: 'web' }));
    const missingDaily = { ...snapshotGscPerformance(data('https://extra.test', () => 10)), daily: undefined, filters: undefined };
    const result = buildCausalImpact({ snapshots: [older, newer, control, missingDaily], interventions: [intervention], market: evidence, updateWindows: [], testSiteUrl: 'https://site.test' });
    expect(result).toMatchObject({ verdict: 'positive', marketNormalized: true, marketSource: 'saved-test-market' });
  });

  it('keeps the stored path honest when the market source is missing or project empty', () => {
    saveGscSnapshot('p1', data('https://site.test', () => 50));
    saveGscSnapshot('p1', data('https://control.test', () => 100));
    addIntervention('p1', intervention, new Date('2026-03-01T00:00:00.000Z'));
    const result = readStoredCausalImpact('p1', { status: 'unknown', source: 'missing-market', observations: [] }, [], 'https://site.test');
    expect(result?.verdict).toBe('inconclusive');
    expect(readStoredCausalImpact(null, null)).toBeNull();
    expect(readStoredCausalImpact('   ', null)).toBeNull();
  });

  it('ranks independent control candidates ahead of dependent candidates and by overlap', () => {
    const snapshots = [
      snapshotGscPerformance(data('https://site.test', () => 50)),
      snapshotGscPerformance(data('https://site.test/blog', () => 100, dates.slice(0, 26))),
      snapshotGscPerformance(data('https://other.test', () => 100, dates.slice(0, 20))),
    ];
    const res = buildCausalImpact({ snapshots, interventions: [intervention], market: evidence, testSiteUrl: 'https://site.test' });
    expect(res?.controlSource).toContain('https://other.test');

    const equalSnapshots = [
      snapshotGscPerformance(data('https://site.test', () => 50)),
      snapshotGscPerformance(data('https://z-control.test', () => 100)),
      snapshotGscPerformance(data('https://m-control.test', () => 100)),
    ];
    const equalRes = buildCausalImpact({ snapshots: equalSnapshots, interventions: [intervention], market: evidence, testSiteUrl: 'https://site.test' });
    expect(equalRes?.controlSource).toContain('https://m-control.test');
  });

  it('enforces cohort filter compatibility across country, device, search type, key order and defaults', () => {
    const baseFilters = { country: 'pol', device: 'DESKTOP' as const, search_type: 'web' as const };
    const mismatches = [
      { country: 'usa', device: 'DESKTOP' as const, search_type: 'web' as const },
      { country: 'pol', device: 'MOBILE' as const, search_type: 'web' as const },
      { country: 'pol', device: 'DESKTOP' as const, search_type: 'image' as const },
    ];
    for (const filters of mismatches) {
      const snap = [snapshotGscPerformance(data('https://site.test', (i) => i < 14 ? 50 : 30, dates, baseFilters)), snapshotGscPerformance(data('https://control.test', (i) => i < 14 ? 50 : 30, dates, filters))];
      const res = buildCausalImpact({ snapshots: snap, interventions: [intervention], market: evidence, updateWindows: [], testSiteUrl: 'https://site.test' });
      expect(res?.verdict).toBe('inconclusive');
      expect(res?.reason).toBe('control-unavailable');
    }
    const orderReversed = { device: 'DESKTOP' as const, search_type: 'web' as const, country: 'POL' };
    const orderSnap = [snapshotGscPerformance(data('https://site.test', (i) => i < 14 ? 50 : 30, dates, baseFilters)), snapshotGscPerformance(data('https://control.test', (i) => i < 14 ? 50 : 30, dates, orderReversed))];
    const orderRes = buildCausalImpact({ snapshots: orderSnap, interventions: [intervention], market: evidence, updateWindows: [], testSiteUrl: 'https://site.test' });
    expect(orderRes?.verdict).toBe('no-effect');
    expect(orderRes?.controlSource).toContain('https://control.test');

    const defaultSnap = [snapshotGscPerformance(data('https://site.test', (i) => i < 14 ? 50 : 65, dates, undefined)), snapshotGscPerformance(data('https://control.test', () => 100, dates, { search_type: 'web' }))];
    const defaultRes = buildCausalImpact({ snapshots: defaultSnap, interventions: [intervention], market: evidence, updateWindows: [], testSiteUrl: 'https://site.test' });
    expect(defaultRes?.verdict).toBe('positive');
  });

  it('matches properties by domain normalization and handles unresolvable targets', () => {
    const domainSnapshots = [
      snapshotGscPerformance(data('https://domain.test/', (i) => i < 14 ? 50 : 70)),
      snapshotGscPerformance(data('https://control.test', () => 100)),
    ];
    expect(buildCausalImpact({ snapshots: domainSnapshots, interventions: [intervention], market: evidence, updateWindows: [], testSiteUrl: 'sc-domain:domain.test' })?.verdict).toBe('positive');
    expect(buildCausalImpact({ snapshots: domainSnapshots, interventions: [intervention], market: evidence, updateWindows: [], testSiteUrl: 'https://other-target.test' })).toBeNull();
    const withoutWindows = buildCausalImpact({ snapshots: domainSnapshots, interventions: [intervention], market: evidence, testSiteUrl: 'https://domain.test/' });
    expect(withoutWindows?.updateFeedStatus).toBe('unknown');
    expect(withoutWindows?.verdict).toBe('inconclusive');
  });

  it('returns null on missing inputs, zero overlap without market, empty daily or unresolvable test group', () => {
    expect(buildCausalImpact({ snapshots: [], interventions: [intervention], market: evidence })).toBeNull();
    const emptyDaily = [snapshotGscPerformance(data('https://site.test', () => 50, []))];
    expect(buildCausalImpact({ snapshots: emptyDaily, interventions: [intervention], market: evidence })).toBeNull();
    const twoSites = [snapshotGscPerformance(data('https://a.test', () => 50)), snapshotGscPerformance(data('https://b.test', () => 50))];
    expect(buildCausalImpact({ snapshots: twoSites, interventions: [intervention], market: evidence })).toBeNull();
    const noOverlap = [
      snapshotGscPerformance(data('https://site.test', () => 50)),
      snapshotGscPerformance(data('https://disjoint.test', () => 100, ['2025-01-01'])),
    ];
    expect(buildCausalImpact({ snapshots: noOverlap, interventions: [intervention], market: null, testSiteUrl: 'https://site.test' })).toBeNull();
    expect(buildCausalImpact({ snapshots: noOverlap, interventions: [intervention], market: evidence, updateWindows: null, testSiteUrl: 'https://site.test' })?.reason).toBe('update-window');
    const dayOne = { ...intervention, date: '2026-03-01' };
    expect(buildCausalImpact({ snapshots: [snapshotGscPerformance(data('https://site.test', () => 50))], interventions: [dayOne], market: evidence })).toBeNull();
  });

  it('renders the produced result in SignalsWorkspace and supports source object windows', async () => {
    saveGscSnapshot('p1', data('https://site.test', (i) => i < 14 ? 50 : 65));
    saveGscSnapshot('p1', data('https://control.test', () => 100));
    addIntervention('p1', intervention, new Date('2026-03-01T00:00:00.000Z'));
    const impact = readStoredCausalImpact('p1', evidence, { status: 'available', source: 'google-search-status', windows: [] }, 'https://site.test');
    expect(impact?.verdict).toBe('positive');
    render(<SignalsWorkspace projectId="p1" pages={[{ url: 'https://site.test' } as never]} graph={graph} />);
    await waitFor(() => expect(screen.getByTestId('causal-impact-panel').textContent).toContain('dataforseo-serp-volatility'));
    expect(screen.getByTestId('causal-impact-panel').textContent).toContain('Positive effect');
  });
});
