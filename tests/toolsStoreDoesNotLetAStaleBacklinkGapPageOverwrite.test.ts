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

it('does not let a stale backlink-gap page overwrite a newer gap analysis in the same project', async () => {
    const projectId = 'project-backlink-gap-order';
    useProjectStore.setState({
      projects: [{ id: projectId, name: 'Backlink gap order', rootUrl: 'https://example.com', createdAt: '2026-09-24T00:00:00.000Z', lastOpenedAt: '2026-09-24T00:00:00.000Z' }],
      activeProjectId: projectId,
    });
    localStorage.setItem('seomi_active_project_v1', projectId);
    useSettingsStore.setState({ dataForSeoCredentials: { login: 'user', password: 'secret' } });
    useToolsStore.setState({
      backlinkGapReport: {
        target: 'example.com', competitors: ['competitor.example'], include_subdomains: true,
        opportunities: [{ referring_domain: 'old-ref.example', target_backlinks: 0, competitor_backlinks: [{ domain: 'competitor.example', backlinks: 1, rank: 10 }], max_competitor_spam_score: null }],
        total_rows: 2, rows_scanned: 1,
      },
      isBacklinkGapLoading: false,
    });

    let releaseStalePage!: (response: Response) => void;
    let gapCalls = 0;
    const response = (result: Record<string, unknown>[]) => new Response(JSON.stringify({ tasks: [{ status_code: 20000, result }] }), { status: 200 });
    const fetchMock = vi.fn((input: string) => {
      if (!String(input).includes('/backlinks/domain_intersection/live')) return Promise.resolve(response([]));
      gapCalls += 1;
      if (gapCalls === 1) return new Promise<Response>((resolve) => { releaseStalePage = resolve; });
      return Promise.resolve(response([{ total_count: 2, items: [{ domain_intersection: { '1': { target: 'fresh-ref.example', backlinks: 4, rank: 20, backlinks_spam_score: 2 } } }] }]));
    });
    vi.stubGlobal('fetch', fetchMock);

    const stalePage = useToolsStore.getState().loadMoreBacklinkGap();
    await Promise.resolve();
    const freshAnalysis = useToolsStore.getState().analyzeBacklinkGap('example.com', ['competitor.example'], true);
    await freshAnalysis;

    expect(useToolsStore.getState().backlinkGapReport?.opportunities[0]?.referring_domain).toBe('fresh-ref.example');

    releaseStalePage(response([{ total_count: 2, items: [{ domain_intersection: { '1': { target: 'stale-ref.example', backlinks: 7, rank: 5, backlinks_spam_score: 8 } } }] }]));
    await stalePage;

    expect(useToolsStore.getState().backlinkGapReport?.opportunities).toHaveLength(1);
    expect(useToolsStore.getState().backlinkGapReport?.opportunities[0]?.referring_domain).toBe('fresh-ref.example');
    expect(useToolsStore.getState().isBacklinkGapLoading).toBe(false);
  });

it('restores Google OAuth client id and selected property only in their project', () => {
    localStorage.setItem('seomi_gsc_client_id_project-gsc-one', '123.apps.googleusercontent.com');
    localStorage.setItem('seomi_gsc_property_project-gsc-one', 'sc-domain:example.com');
    useToolsStore.getState().hydrateProject('project-gsc-one');
    expect(useToolsStore.getState()).toMatchObject({
      gscClientId: '123.apps.googleusercontent.com',
      gscProperty: 'sc-domain:example.com',
      gscProperties: [],
      isGscConnected: false,
    });

    useToolsStore.getState().hydrateProject('project-gsc-two');
    expect(useToolsStore.getState()).toMatchObject({ gscClientId: '', gscProperty: '', isGscConnected: false });
  });

it('moves real legacy keyword and rank records to the first selected project once', () => {
    const projectId = 'first-project';
    localStorage.setItem('seomi_active_project_v1', projectId);
    localStorage.setItem('seomi_saved_keywords', JSON.stringify([{ id: 'legacy-keyword', keyword: 'real record',
      search_volume: 0, difficulty: 0, cpc: 0, intent: 'Informational', tags: [], addedAt: '2026-10-01T00:00:00Z' }]));
    localStorage.setItem('seomi_tracked_ranks', JSON.stringify([{ id: 'legacy-rank', keyword: 'real rank', history: [] }]));

    useToolsStore.getState().hydrateProject(projectId);

    expect(useToolsStore.getState().savedKeywords).toMatchObject([{ id: 'legacy-keyword', keyword: 'real record' }]);
    expect(useToolsStore.getState().trackedRanks).toMatchObject([{ id: 'legacy-rank', keyword: 'real rank' }]);
    expect(JSON.parse(localStorage.getItem(`seomi_project_${projectId}_saved_keywords`) || '[]')).toHaveLength(1);
    expect(localStorage.getItem('seomi_saved_keywords')).toBeNull();
    expect(localStorage.getItem('seomi_legacy_tools_migrated_v1')).toBe('true');

    localStorage.setItem('seomi_active_project_v1', 'second-project');
    useToolsStore.getState().hydrateProject('second-project');
    expect(useToolsStore.getState().savedKeywords).toEqual([]);
    expect(useToolsStore.getState().trackedRanks).toEqual([]);
  });

it('normalizes legacy rank locations and languages during project hydration', () => {
    const projectId = 'legacy-rank-market-project';
    localStorage.setItem('seomi_active_project_v1', projectId);
    localStorage.setItem(`seomi_project_${projectId}_tracked_ranks`, JSON.stringify([
      { id: 'legacy-de', keyword: 'seo audit', domain: 'example.de', location: 'Germany', history: [] },
      { id: 'legacy-ch', keyword: 'seo audit', domain: 'example.ch', location: 'CH', language_code: 'it', history: [] },
    ]));

    useToolsStore.getState().hydrateProject(projectId);

    expect(useToolsStore.getState().trackedRanks).toMatchObject([
      { id: 'legacy-de', location: 'DE', language_code: 'de', target_url: 'https://example.de' },
      { id: 'legacy-ch', location: 'CH', language_code: 'it', target_url: 'https://example.ch' },
    ]);
    expect(JSON.parse(localStorage.getItem(`seomi_project_${projectId}_tracked_ranks`) || '[]')).toMatchObject([
      { location: 'DE', language_code: 'de' },
      { location: 'CH', language_code: 'it' },
    ]);
  });
});
