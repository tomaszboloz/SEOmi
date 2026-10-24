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

vi.mock('@/services/causalMarket/source', () => ({
  fetchSerpVolatility: vi.fn(async () => ({
    status: 'available', source: 'saved-test-market',
    observations: Array.from({ length: 28 }, (_, index) => ({ date: `2026-03-${String(index + 1).padStart(2, '0')}`, level: 100 })),
  })),
  fetchGoogleSearchUpdateWindows: vi.fn(async () => ({ status: 'available', source: 'google-search-status', windows: [] })),
}));

const graph: SemanticMap = { nodes: [], edges: [], topicEdges: [], clusters: [], totalEdges: 0, totalTopicEdges: 0, totalInternalLinks: 0, hasSemanticTerms: false, truncated: false };
const dates = Array.from({ length: 28 }, (_, index) => `2026-03-${String(index + 1).padStart(2, '0')}`);
const intervention = { id: 'i1', projectId: 'p1', url: 'site' as const, date: '2026-03-15', kind: 'content' as const, note: '', createdAt: '2026-03-01T00:00:00.000Z' };

const data = (site_url: string, clicks: (index: number) => number): GscPerformanceData => {
  const daily = dates.map((date, index) => ({ date, clicks: clicks(index), impressions: clicks(index) * 10, ctr: 0.1, position: 2 }));
  return { site_url, start_date: dates[0], end_date: dates.at(-1)!, total_clicks: daily.reduce((sum, row) => sum + row.clicks, 0), total_impressions: daily.reduce((sum, row) => sum + row.impressions, 0), avg_ctr: 0.1, avg_position: 2, queries: [], pages: [], daily, daily_may_be_truncated: false, queries_may_be_truncated: false, pages_may_be_truncated: false, max_rows_per_dimension: 1000 };
};

const evidence = { status: 'available' as const, source: 'saved-test-market', observations: dates.map((date) => ({ date, level: 100 })) };

beforeEach(async () => { localStorage.clear(); await i18n.changeLanguage('en'); });
afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

describe('causal market stored adapter', () => {
  it('builds an impact from saved GSC series and an external market baseline', () => {
    const snapshots = [
      snapshotGscPerformance(data('https://site.test', (index) => index < 14 ? 50 : 65)),
      snapshotGscPerformance(data('https://control.test', () => 100)),
    ];
    const result = buildCausalImpact({ snapshots, interventions: [intervention], market: evidence, testSiteUrl: 'https://site.test' });
    expect(result).toMatchObject({ verdict: 'positive', marketNormalized: true, marketSource: 'saved-test-market' });
    expect(result?.controlSource).toContain('https://control.test');
  });

  it('keeps the stored path honest when the market source is missing', () => {
    const projectSnapshots = [snapshotGscPerformance(data('https://site.test', () => 50)), snapshotGscPerformance(data('https://control.test', () => 100))];
    saveGscSnapshot('p1', data('https://site.test', () => 50));
    saveGscSnapshot('p1', data('https://control.test', () => 100));
    addIntervention('p1', intervention, new Date('2026-03-01T00:00:00.000Z'));
    const result = readStoredCausalImpact('p1', { status: 'unknown', source: 'missing-market', observations: [] }, [], 'https://site.test');
    expect(buildCausalImpact({ snapshots: projectSnapshots, interventions: [intervention], market: null, testSiteUrl: 'https://site.test' })?.reason).toBe('market-unavailable');
    expect(result?.verdict).toBe('inconclusive');
  });

  it('renders the produced result in SignalsWorkspace', async () => {
    saveGscSnapshot('p1', data('https://site.test', (index) => index < 14 ? 50 : 65));
    saveGscSnapshot('p1', data('https://control.test', () => 100));
    addIntervention('p1', intervention, new Date('2026-03-01T00:00:00.000Z'));
    render(<SignalsWorkspace projectId="p1" pages={[{ url: 'https://site.test' } as never]} graph={graph} />);
    await waitFor(() => expect(screen.getByTestId('causal-impact-panel').textContent).toContain('Normalized by market baseline'));
    expect(screen.getByTestId('causal-impact-panel').textContent).toContain('saved-test-market');
  });
});
