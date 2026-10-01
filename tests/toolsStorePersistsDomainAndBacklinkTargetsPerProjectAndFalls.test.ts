import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { invokeTauriCommand, isTauriEnvironment } from '@/services/tauri';

import { useToolsStore } from '../src/stores/toolsStore';
import { useSettingsStore } from '../src/stores/settingsStore';
import { useProjectStore } from '@/stores/projectStore';

vi.mock('@/services/tauri', () => ({
  invokeTauriCommand: vi.fn(),
  isTauriEnvironment: vi.fn(() => false),
  getSecureValue: vi.fn(async () => ''),
}));

describe('toolsStore', () => {
beforeEach(() => {
    localStorage.clear();
    vi.mocked(invokeTauriCommand).mockReset();
    vi.mocked(isTauriEnvironment).mockReturnValue(false);
    useToolsStore.setState({ keywordResults: [], keywordResultsSource: null, keywordError: null, crawlRuns: [], crawlResult: null, selectedCrawlRunId: null, backlinkProfileHistory: [] });
    useSettingsStore.setState({ dataForSeoCredentials: { login: '', password: '' } });
  });

afterEach(() => vi.unstubAllGlobals());

it('persists domain and backlink targets per project and falls back to each project root', async () => {
    const firstProject = 'project-query-one';
    const secondProject = 'project-query-two';
    useProjectStore.setState({
      projects: [
        { id: firstProject, name: 'First project', rootUrl: 'https://www.example.com/start', createdAt: '2026-09-24T00:00:00.000Z', lastOpenedAt: '2026-09-24T00:00:00.000Z' },
        { id: secondProject, name: 'Second project', rootUrl: 'https://second.example.org', createdAt: '2026-09-24T00:00:00.000Z', lastOpenedAt: '2026-09-24T00:00:00.000Z' },
      ],
      activeProjectId: firstProject,
    });
    localStorage.setItem('seomi_active_project_v1', firstProject);

    await useToolsStore.getState().hydrateProject(firstProject);
    expect(useToolsStore.getState()).toMatchObject({ domainQuery: 'example.com', backlinkQuery: 'example.com' });

    useToolsStore.getState().setDomainQuery('https://custom.example.net/path');
    useToolsStore.getState().setBacklinkQuery('links.example.net');
    expect(localStorage.getItem(`seomi_project_${firstProject}_domain_query_v1`)).toBe('https://custom.example.net/path');
    expect(localStorage.getItem(`seomi_project_${firstProject}_backlink_query_v1`)).toBe('links.example.net');

    localStorage.setItem('seomi_active_project_v1', secondProject);
    useProjectStore.setState({ activeProjectId: secondProject });
    await useToolsStore.getState().hydrateProject(secondProject);
    expect(useToolsStore.getState()).toMatchObject({ domainQuery: 'second.example.org', backlinkQuery: 'second.example.org' });

    localStorage.setItem('seomi_active_project_v1', firstProject);
    useProjectStore.setState({ activeProjectId: firstProject });
    await useToolsStore.getState().hydrateProject(firstProject);
    expect(useToolsStore.getState()).toMatchObject({ domainQuery: 'https://custom.example.net/path', backlinkQuery: 'links.example.net' });
  });

it('keeps an explicitly cleared domain or backlink target empty instead of restoring the project root', async () => {
    const projectId = 'project-query-cleared';
    useProjectStore.setState({
      projects: [{ id: projectId, name: 'Clear query project', rootUrl: 'https://example.com', createdAt: '2026-09-24T00:00:00.000Z', lastOpenedAt: '2026-09-24T00:00:00.000Z' }],
      activeProjectId: projectId,
    });
    localStorage.setItem('seomi_active_project_v1', projectId);

    await useToolsStore.getState().hydrateProject(projectId);
    useToolsStore.getState().setDomainQuery('');
    useToolsStore.getState().setBacklinkQuery('');
    await useToolsStore.getState().hydrateProject(projectId);

    expect(useToolsStore.getState()).toMatchObject({ domainQuery: '', backlinkQuery: '' });
  });

it('restores the last factual domain, backlink and gap responses only in their project', async () => {
    const projectId = 'project-research-persistence';
    localStorage.setItem('seomi_active_project_v1', projectId);
    const domain = { domain: 'example.com', organic_traffic: 1200, organic_keywords: 60, domain_rank: 25, referring_domains: 8, top_keywords: [], top_pages: [], competitors: [] };
    const profile = { domain: 'example.com', total_backlinks: 40, referring_domains: 8, referring_subnets: null, domain_rank: 25, dofollow_ratio: 50, total_anchor_rows: 0, total_backlink_rows: 0, anchors: [], backlinks: [] };
    const gap = { target: 'example.com', competitors: ['competitor.example'], include_subdomains: true, opportunities: [], total_rows: 0, rows_scanned: 0 };
    localStorage.setItem(`seomi_project_${projectId}_domain_overview_v1`, JSON.stringify(domain));
    localStorage.setItem(`seomi_project_${projectId}_backlink_profile_v1`, JSON.stringify(profile));
    localStorage.setItem(`seomi_project_${projectId}_backlink_gap_report_v1`, JSON.stringify(gap));

    await useToolsStore.getState().hydrateProject(projectId);
    expect(useToolsStore.getState()).toMatchObject({ domainOverview: domain, backlinkProfile: profile, backlinkGapReport: gap });

    localStorage.setItem('seomi_active_project_v1', 'other-research-project');
    await useToolsStore.getState().hydrateProject('other-research-project');
    expect(useToolsStore.getState()).toMatchObject({ domainOverview: null, backlinkProfile: null, backlinkGapReport: null });
  });

it('compares live domains with DataForSEO and persists only returned metrics per project', async () => {
    const projectId = 'project-domain-compare';
    localStorage.setItem('seomi_active_project_v1', projectId);
    useSettingsStore.setState({ dataForSeoCredentials: { login: 'user', password: 'secret' } });
    useToolsStore.setState({ domainOverview: { domain: 'example.com' } as never });
    vi.stubGlobal('fetch', vi.fn(async (input: string) => {
      const url = String(input);
      let items: Record<string, unknown>[] = [];
      if (url.includes('/domain_rank_overview/')) items = [{ metrics: { organic: { etv: 1200, count: 60 } } }];
      if (url.includes('/ranked_keywords/')) items = [];
      if (url.includes('/relevant_pages/')) items = [];
      if (url.includes('/competitors_domain/')) items = [];
      const result = url.includes('/backlinks/summary/')
        ? [{ backlinks: 40, referring_domains: 8, rank: 25, dofollow: 20, broken_backlinks: 0 }]
        : [{ items }];
      return new Response(JSON.stringify({ tasks: [{ status_code: 20000, result }] }), { status: 200 });
    }));

    await useToolsStore.getState().compareDomains(['example.com', 'competitor.example']);

    expect(useToolsStore.getState().domainComparison?.rows).toHaveLength(2);
    expect(useToolsStore.getState().domainComparison?.rows[0]).toMatchObject({ domain: 'example.com', organic_traffic: 1200, organic_keywords: 60, total_backlinks: 40, dofollow_ratio: 50 });
    expect(useToolsStore.getState().domainComparisonHistory).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem(`${'seomi_project_'}${projectId}_domain_comparison_history_v1`) || '[]')).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem(`${'seomi_project_'}${projectId}_domain_comparison_targets_v1`) || '[]')).toEqual(['example.com', 'competitor.example']);
  });

it('hydrates project-scoped comparison history and preserves missing metric values', async () => {
    const projectId = 'project-domain-history';
    localStorage.setItem('seomi_active_project_v1', projectId);
    const history = [
      {
        target: 'example.com',
        rows: [{ domain: 'example.com', organic_traffic: 100, organic_keywords: null, domain_rank: null, referring_domains: 3, retrieved_at: '2026-09-20T12:00:00.000Z' }],
        location_code: 2840,
        language_code: 'en',
        retrieved_at: '2026-09-20T12:00:00.000Z',
        source: 'dataforseo',
      },
      {
        target: 'example.com',
        rows: [{ domain: 'example.com', organic_traffic: 140, organic_keywords: 12, domain_rank: null, referring_domains: null, retrieved_at: '2026-09-21T12:00:00.000Z' }],
        location_code: 2840,
        language_code: 'en',
        retrieved_at: '2026-09-21T12:00:00.000Z',
        source: 'dataforseo',
      },
    ];
    localStorage.setItem(`seomi_project_${projectId}_domain_comparison_history_v1`, JSON.stringify(history));

    await useToolsStore.getState().hydrateProject(projectId);

    expect(useToolsStore.getState().domainComparisonHistory).toHaveLength(2);
    expect(useToolsStore.getState().domainComparisonHistory[0].rows[0].organic_keywords).toBeNull();
    expect(useToolsStore.getState().domainComparison).toEqual(history[1]);
  });
});
