import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { SignalsWorkspace } from '@/components/Charts/semanticTopical/signals/SignalsWorkspace';
import { useAppHydration } from '@/hooks/app/useAppHydration';
import { addIntervention } from '@/services/experiments/registry';
import { saveGscSnapshot } from '@/services/gscTracker/persistence';
import * as marketSource from '@/services/causalMarket/source';
import { useToolsStore } from '@/stores/toolsStore';
import { useProjectStore } from '@/stores/projectStore';
import { toolsServices } from '@/stores/tools/services';
import type { GscPerformanceData, GscPerformanceFilters, CrawledPageSummary } from '@/types';
import type { SemanticMap } from '@/services/semanticGraph/types';

const dates = Array.from({ length: 28 }, (_, index) => `2026-03-${String(index + 1).padStart(2, '0')}`);
const graph: SemanticMap = { nodes: [], edges: [], topicEdges: [], clusters: [], totalEdges: 0, totalTopicEdges: 0, totalInternalLinks: 0, hasSemanticTerms: false, truncated: false };
const pages = [{ url: 'https://example.com/first-crawl-page', final_url: 'https://example.com/first-crawl-page' }] as unknown as CrawledPageSummary[];
const filters: GscPerformanceFilters = { search_type: 'web', device: 'DESKTOP', country: 'pol' };

const data = (site_url: string, clicks: (index: number) => number, selectedFilters = filters): GscPerformanceData => {
  const daily = dates.map((date, index) => ({ date, clicks: clicks(index), impressions: 100, ctr: 0.1, position: 2 }));
  return { site_url, start_date: dates[0], end_date: dates.at(-1)!, filters: selectedFilters, total_clicks: daily.reduce((sum, row) => sum + row.clicks, 0), total_impressions: 2800, avg_ctr: 0.1, avg_position: 2, queries: [], pages: [], daily, daily_may_be_truncated: false, queries_may_be_truncated: false, pages_may_be_truncated: false, max_rows_per_dimension: 1000 };
};

const addEvidence = (projectId: string, site: string, clicks: (index: number) => number, selectedFilters = filters) => saveGscSnapshot(projectId, data(site, clicks, selectedFilters));
const intervention = (projectId: string) => addIntervention(projectId, { url: 'site', date: '2026-03-15', kind: 'content', note: '' }, new Date('2026-03-01T00:00:00Z'));

beforeEach(async () => {
  localStorage.clear();
  useProjectStore.setState({ projects: [], activeProjectId: null });
  await i18n.changeLanguage('en');
  vi.spyOn(marketSource, 'fetchSerpVolatility').mockResolvedValue({ status: 'available', source: 'test-market', observations: dates.map((date) => ({ date, level: 100 })) });
  vi.spyOn(marketSource, 'fetchGoogleSearchUpdateWindows').mockResolvedValue({ status: 'available', source: 'test-updates', windows: [] });
  useToolsStore.setState({ gscProperty: '', gscFilters: {}, gscHydratedProjectId: null });
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); });

describe('mounted SignalsWorkspace GSC property scope', () => {
  it('uses the selected exact property and filters instead of the first crawl URL or sibling snapshot', async () => {
    addEvidence('project-a', 'https://example.com/blog/', (index) => index < 14 ? 50 : 80, filters);
    addEvidence('project-a', 'https://example.com/blog/', (index) => index < 14 ? 100 : 40, { ...filters, device: 'MOBILE' });
    addEvidence('project-a', 'https://example.com/store/', (index) => index < 14 ? 100 : 40, filters);
    addEvidence('project-a', 'https://control.example.net/', () => 100, filters);
    intervention('project-a');
    useToolsStore.setState({ gscProperty: 'https://example.com/blog/', gscFilters: filters, gscHydratedProjectId: 'project-a' });

    render(<SignalsWorkspace projectId="project-a" pages={pages} graph={graph} />);

    expect(await screen.findByText('Positive effect')).toBeTruthy();
    expect(screen.queryByText('Negative effect')).toBeNull();
  });

  it('keeps the mounted result unknown for an unmatched property and invalidates it on project/property switch', async () => {
    addEvidence('project-a', 'https://example.com/blog/', (index) => index < 14 ? 50 : 80, filters);
    addEvidence('project-a', 'https://control.example.net/', () => 100, filters);
    intervention('project-a');
    useToolsStore.setState({ gscProperty: 'https://example.com/blog/', gscFilters: filters, gscHydratedProjectId: 'project-a' });
    const view = render(<SignalsWorkspace projectId="project-a" pages={pages} graph={graph} />);
    expect(await screen.findByText('Positive effect')).toBeTruthy();

    useToolsStore.setState({ gscProperty: 'https://example.com/missing/', gscFilters: filters, gscHydratedProjectId: 'project-a' });
    view.rerender(<SignalsWorkspace projectId="project-a" pages={pages} graph={graph} />);
    expect(await screen.findByText('Not estimable. Not enough history: need at least 7 days before and 1 after, a real external market series, and independent control evidence.')).toBeTruthy();

    addEvidence('project-b', 'https://other.example.org/', () => 60, filters);
    addEvidence('project-b', 'https://control.other.net/', () => 60, filters);
    intervention('project-b');
    useToolsStore.setState({ gscProperty: 'https://other.example.org/', gscFilters: filters, gscHydratedProjectId: 'project-b' });
    view.rerender(<SignalsWorkspace projectId="project-b" pages={pages} graph={graph} />);
    expect(await screen.findByText('No measurable effect')).toBeTruthy();
  });

  it('gates the mounted production path on real project hydration and rejects late prior-project completion', async () => {
    const projects = [
      { id: 'project-a', name: 'A', rootUrl: 'https://a.example/', createdAt: '2026-01-01T00:00:00.000Z', lastOpenedAt: '2026-01-01T00:00:00.000Z' },
      { id: 'project-b', name: 'B', rootUrl: 'https://b.example/', createdAt: '2026-01-01T00:00:00.000Z', lastOpenedAt: '2026-01-01T00:00:00.000Z' },
    ];
    useProjectStore.setState({ projects, activeProjectId: 'project-a' });
    localStorage.setItem('seomi_gsc_property_project-a', 'https://a.example/');
    localStorage.setItem('seomi_gsc_property_project-b', 'https://b.example/');
    localStorage.setItem('seomi_gsc_filters_project-a_v1', JSON.stringify(filters));
    localStorage.setItem('seomi_gsc_filters_project-b_v1', JSON.stringify(filters));
    addEvidence('project-a', 'https://a.example/', (index) => index < 14 ? 100 : 50, filters);
    addEvidence('project-a', 'https://a-control.example/', () => 100, filters);
    addEvidence('project-b', 'https://b.example/', (index) => index < 14 ? 50 : 80, filters);
    addEvidence('project-b', 'https://b-control.example/', () => 100, filters);
    intervention('project-a');
    intervention('project-b');

    const deferredRuns = new Map<string, { resolve: () => void }>();
    vi.spyOn(toolsServices, 'loadCrawlRuns').mockImplementation((projectId) => {
      const wait = new Promise<Awaited<ReturnType<typeof toolsServices.loadCrawlRuns>>>((resolve) => {
        deferredRuns.set(projectId, { resolve: () => resolve([]) });
      });
      return wait;
    });
    const Harness = () => {
      useAppHydration();
      const activeProjectId = useProjectStore((state) => state.activeProjectId);
      return activeProjectId ? <SignalsWorkspace projectId={activeProjectId} pages={pages} graph={graph} /> : null;
    };

    render(<Harness />);
    await waitFor(() => expect(deferredRuns.has('project-a')).toBe(true));
    expect(useToolsStore.getState().gscHydratedProjectId).toBeNull();
    expect(screen.queryByText('Positive effect')).toBeNull();
    expect(screen.queryByText('Negative effect')).toBeNull();

    useProjectStore.getState().selectProject('project-b');
    await waitFor(() => expect(deferredRuns.has('project-b')).toBe(true));
    expect(useToolsStore.getState().gscHydratedProjectId).toBeNull();
    expect(screen.queryByText('Positive effect')).toBeNull();
    expect(screen.queryByText('Negative effect')).toBeNull();

    deferredRuns.get('project-b')!.resolve();
    await waitFor(() => expect(useToolsStore.getState().gscHydratedProjectId).toBe('project-b'));
    expect(useToolsStore.getState().gscProperty).toBe('https://b.example/');
    expect(await screen.findByText('Positive effect')).toBeTruthy();

    deferredRuns.get('project-a')!.resolve();
    await waitFor(() => expect(useToolsStore.getState().gscHydratedProjectId).toBe('project-b'));
    expect(useToolsStore.getState().gscProperty).toBe('https://b.example/');
    expect(screen.getByText('Positive effect')).toBeTruthy();
  });
});
