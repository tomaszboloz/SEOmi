import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import i18n from '@/i18n';
import { SignalsWorkspace } from '@/components/Charts/semanticTopical/signals/SignalsWorkspace';
import { buildCausalImpact, estimateImpact, dispatchCausalStorageEvent } from '@/services/causalMarket';
import { saveGscSnapshot } from '@/services/gscTracker/persistence';
import { snapshotGscPerformance } from '@/services/gscTracker/snapshot';
import { addIntervention, experimentsKey } from '@/services/experiments/registry';
import { gscSnapshotStorageKey } from '@/services/gscTracker/limits';
import type { GscPerformanceData } from '@/types';
import type { SemanticMap } from '@/services/semanticGraph/types';
import * as marketSource from '@/services/causalMarket/source';

const graph: SemanticMap = { nodes: [], edges: [], topicEdges: [], clusters: [], totalEdges: 0, totalTopicEdges: 0, totalInternalLinks: 0, hasSemanticTerms: false, truncated: false };
const dates = Array.from({ length: 28 }, (_, i) => `2026-03-${String(i + 1).padStart(2, '0')}`);
const mockObservations = dates.map((date) => ({ date, level: 100 }));

const mockData = (site_url: string, clicks: (i: number) => number): GscPerformanceData => {
  const daily = dates.map((date, i) => ({ date, clicks: clicks(i), impressions: clicks(i) * 10, ctr: 0.1, position: 2 }));
  return { site_url, start_date: dates[0], end_date: dates.at(-1)!, total_clicks: daily.reduce((s, r) => s + r.clicks, 0), total_impressions: daily.reduce((s, r) => s + r.impressions, 0), avg_ctr: 0.1, avg_position: 2, queries: [], pages: [], daily, daily_may_be_truncated: false, queries_may_be_truncated: false, pages_may_be_truncated: false, max_rows_per_dimension: 1000 };
};

const interventionFor = (projectId: string) => ({ id: `inv-${projectId}`, projectId, url: 'site' as const, date: '2026-03-15', kind: 'content' as const, note: '', createdAt: '2026-03-01T00:00:00.000Z' });

beforeEach(async () => { localStorage.clear(); await i18n.changeLanguage('en'); });
afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

describe('causal impact runtime resilience', () => {
  it('handles null project and external storage events safely', () => {
    const { rerender, unmount } = render(<SignalsWorkspace projectId={null} pages={[]} graph={graph} />);
    expect(screen.getByTestId('causal-impact-panel').textContent).toContain('Not estimable');
    rerender(<SignalsWorkspace projectId="p1" pages={[]} graph={graph} />);
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: gscSnapshotStorageKey('p1') }));
      window.dispatchEvent(new StorageEvent('storage', { key: experimentsKey('p1') }));
      window.dispatchEvent(new StorageEvent('storage', { key: null }));
      window.dispatchEvent(new StorageEvent('storage', { key: 'unrelated-key' }));
      dispatchCausalStorageEvent(experimentsKey('p1'));
      dispatchCausalStorageEvent(null);
      dispatchCausalStorageEvent('unrelated');
    });
    unmount();
  });

  it('does not treat sc-domain and https URL properties of same domain as independent control', () => {
    const snapshots = [
      snapshotGscPerformance(mockData('sc-domain:example.com', (i) => i < 14 ? 50 : 80)),
      snapshotGscPerformance(mockData('https://example.com/', () => 100)),
    ];
    const market = { status: 'available' as const, source: 'test-market', observations: mockObservations };
    const result = buildCausalImpact({ snapshots, interventions: [interventionFor('p1')], market, testSiteUrl: 'sc-domain:example.com' });
    expect(result?.verdict).toBe('inconclusive');
    expect(result?.reason).toBe('control-unavailable');
    expect(result?.controlSource).toBeNull();
  });

  it('calculates market impact even when no separate control property exists', () => {
    const snapshots = [snapshotGscPerformance(mockData('https://solosite.test', (i) => i < 14 ? 50 : 80))];
    const market = { status: 'available' as const, source: 'market-niche-volatility', observations: mockObservations };
    const result = buildCausalImpact({ snapshots, interventions: [interventionFor('p1')], market, testSiteUrl: 'https://solosite.test' });
    expect(result).not.toBeNull();
    expect(result?.marketNormalized).toBe(false);
    expect(result?.verdict).toBe('inconclusive');
    expect(result?.reason).toBe('control-unavailable');
  });

  it('propagates unavailable update-feed status as update-window warning instead of silent empty', () => {
    const snapshots = [
      snapshotGscPerformance(mockData('https://site.test', (i) => i < 14 ? 50 : 80)),
      snapshotGscPerformance(mockData('https://control.test', () => 100)),
    ];
    const market = { status: 'available' as const, source: 'test-market', observations: mockObservations };
    const result = buildCausalImpact({
      snapshots, interventions: [interventionFor('p1')], market,
      updateWindows: { status: 'unavailable', source: 'google-search-status', windows: [], reason: 'network' },
      testSiteUrl: 'https://site.test',
    });
    expect(result?.updateWindow).toBe(true);
    expect(result?.reason).toBe('update-window');
    expect(result?.verdict).toBe('inconclusive');
  });

  it('refreshes on same-document localStorage changes and discards aborted async runs', async () => {
    let pendingResolve: ((val: marketSource.MarketSourceResult) => void) | null = null;
    vi.spyOn(marketSource, 'fetchSerpVolatility').mockImplementation(async () =>
      new Promise((res) => { pendingResolve = res; }));
    vi.spyOn(marketSource, 'fetchGoogleSearchUpdateWindows').mockResolvedValue({ status: 'available', source: 'google-search-status', windows: [] });

    saveGscSnapshot('p1', mockData('https://live.test', (i) => i < 14 ? 50 : 80));
    saveGscSnapshot('p1', mockData('https://independent.test', () => 100));

    const { unmount } = render(<SignalsWorkspace projectId="p1" pages={[{ url: 'https://live.test' } as never]} graph={graph} />);
    act(() => { addIntervention('p1', interventionFor('p1')); });

    unmount();
    act(() => { pendingResolve!({ status: 'available', source: 'aborted-market', observations: mockObservations }); });
  });

  it('prevents project A evidence leak during A->B switch with deferred promises', async () => {
    let resolveB: ((val: marketSource.MarketSourceResult) => void) | null = null;
    vi.spyOn(marketSource, 'fetchSerpVolatility').mockImplementation(async () => {
      if (resolveB) return new Promise((res) => { resolveB = res; });
      return { status: 'available', source: 'market-A', observations: mockObservations };
    });
    vi.spyOn(marketSource, 'fetchGoogleSearchUpdateWindows').mockResolvedValue({ status: 'available', source: 'google-search-status', windows: [] });

    saveGscSnapshot('pA', mockData('https://site-a.test', (i) => i < 14 ? 50 : 80));
    saveGscSnapshot('pA', mockData('https://control-a.test', () => 100));
    addIntervention('pA', interventionFor('pA'));

    saveGscSnapshot('pB', mockData('https://site-b.test', () => 40));
    saveGscSnapshot('pB', mockData('https://control-b.test', () => 100));
    addIntervention('pB', interventionFor('pB'));

    const { rerender } = render(<SignalsWorkspace projectId="pA" pages={[{ url: 'https://site-a.test' } as never]} graph={graph} />);
    await waitFor(() => expect(screen.getByTestId('causal-impact-panel').textContent).toContain('market-A'));

    new Promise((res) => { resolveB = res; });
    rerender(<SignalsWorkspace projectId="pB" pages={[{ url: 'https://site-b.test' } as never]} graph={graph} />);

    expect(screen.getByTestId('causal-impact-panel').textContent).not.toContain('market-A');

    await act(async () => {
      resolveB!({ status: 'available', source: 'market-B', observations: mockObservations });
    });
    await waitFor(() => expect(screen.getByTestId('causal-impact-panel').textContent).toContain('market-B'));
  });

  it('treats whitespace or empty controlSource as control-unavailable', () => {
    const out = estimateImpact({
      dates, test: dates.map(() => 50), control: dates.map(() => 50),
      market: dates.map(() => 100), marketSource: 'test-market',
      controlSource: '   ', controlIndependent: true,
      interventionDate: '2026-03-15', updateWindows: [],
    });
    expect(out?.reason).toBe('control-unavailable');
    expect(out?.verdict).toBe('inconclusive');
  });
});
