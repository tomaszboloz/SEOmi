import { createCrawlPageFixture, createCrawlResultFixture } from './fixtures/crawl';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { invokeTauriCommand, isTauriEnvironment } from '@/services/tauri';
import { loadCrawlRuns } from '@/services/crawlPersistence';
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

it('stores exact DataForSEO retrieval context with keyword results for topical import', async () => {
    localStorage.setItem('seomi_active_project_v1', 'keyword-project');
    useSettingsStore.setState({ dataForSeoCredentials: { login: 'user', password: 'secret' } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ tasks: [{ status_code: 20000, result: [{ items: [{ keyword: 'coffee grinder', search_volume: 900, cpc: 1.5, competition_index: 35, search_intent_info: { main_intent: 'commercial' } }] }] }] }), { status: 200 })));

    await useToolsStore.getState().searchKeywords('coffee', 'PL');

    expect(useToolsStore.getState().keywordResultsSource).toMatchObject({ seedKeyword: 'coffee', countryCode: 'PL', locationCode: 2616, languageCode: 'pl' });
    expect(useToolsStore.getState().keywordResultsSource?.retrievedAt).toMatch(/^\d{4}-\d\d-\d\dT/);
    expect(useToolsStore.getState().keywordResults[0].sourceMetrics).toMatchObject({ searchVolume: 900, cpc: 1.5, competitionIndex: 35, intent: 'commercial' });

    localStorage.setItem('seomi_active_project_v1', 'other-project');
    await useToolsStore.getState().hydrateProject('other-project');
    expect(useToolsStore.getState().keywordResultsSource).toBeNull();
    expect(useToolsStore.getState().keywordResults).toEqual([]);
  });

it('persists keyword seed and market per project without leaking them across workspaces', async () => {
    const firstProject = 'project-keyword-one';
    const secondProject = 'project-keyword-two';
    useProjectStore.setState({
      projects: [
        { id: firstProject, name: 'Keyword one', rootUrl: 'https://one.example', createdAt: '2026-09-24T00:00:00.000Z', lastOpenedAt: '2026-09-24T00:00:00.000Z' },
        { id: secondProject, name: 'Keyword two', rootUrl: 'https://two.example', createdAt: '2026-09-24T00:00:00.000Z', lastOpenedAt: '2026-09-24T00:00:00.000Z' },
      ],
      activeProjectId: firstProject,
    });
    localStorage.setItem('seomi_active_project_v1', firstProject);

    await useToolsStore.getState().hydrateProject(firstProject);
    useToolsStore.getState().setKeywordQuery('technical seo');
    useToolsStore.getState().setKeywordCountry('PL');
    expect(localStorage.getItem(`seomi_project_${firstProject}_keyword_query_v1`)).toBe('technical seo');
    expect(localStorage.getItem(`seomi_project_${firstProject}_keyword_country_v1`)).toBe('PL');

    localStorage.setItem('seomi_active_project_v1', secondProject);
    useProjectStore.setState({ activeProjectId: secondProject });
    await useToolsStore.getState().hydrateProject(secondProject);
    expect(useToolsStore.getState()).toMatchObject({ keywordQuery: '', keywordCountry: 'US' });

    localStorage.setItem('seomi_active_project_v1', firstProject);
    useProjectStore.setState({ activeProjectId: firstProject });
    await useToolsStore.getState().hydrateProject(firstProject);
    expect(useToolsStore.getState()).toMatchObject({ keywordQuery: 'technical seo', keywordCountry: 'PL' });
  });

it('hydrates a persisted crawl history only for the selected project', async () => {
    const projectId = 'project-crawl-history';
    localStorage.setItem('seomi_active_project_v1', projectId);
    const result = { ...createCrawlResultFixture(),
      start_url: 'https://example.com/', pages_crawled: 1, health_score: 100,
      critical_count: 0, warning_count: 0, notice_count: 0, duration_ms: 25, cancelled: false, timed_out: false,
      pages: [],
    };
    localStorage.setItem(`seomi_project_${projectId}_crawl_runs`, JSON.stringify([
      { id: 'run-1', completedAt: '2026-09-20T12:00:00.000Z', startUrl: 'https://example.com/', config: { includePatterns: [], excludePatterns: [], allowSubdomains: false, keepQueryStrings: false }, result },
    ]));

    await useToolsStore.getState().hydrateProject(projectId);

    expect(useToolsStore.getState().crawlRuns).toHaveLength(1);
    expect(useToolsStore.getState().crawlResult?.start_url).toBe('https://example.com/');
    expect(useToolsStore.getState().selectedCrawlRunId).toBe('run-1');
  });

it('uses the project root URL as the first crawl target without overwriting saved crawl settings', async () => {
    const projectId = 'project-root-crawl';
    useProjectStore.setState({
      projects: [{ id: projectId, name: 'Root project', rootUrl: 'https://example.com/start', createdAt: '2026-09-24T00:00:00.000Z', lastOpenedAt: '2026-09-24T00:00:00.000Z' }],
      activeProjectId: projectId,
    });
    localStorage.setItem('seomi_active_project_v1', projectId);

    await useToolsStore.getState().hydrateProject(projectId);
    expect(useToolsStore.getState().crawlUrl).toBe('https://example.com/start');

    localStorage.setItem(`seomi_project_${projectId}_crawl_settings`, JSON.stringify({
      url: 'https://example.com/saved', limit: 50, config: { includePatterns: ['/docs/'] },
    }));
    await useToolsStore.getState().hydrateProject(projectId);
    expect(useToolsStore.getState().crawlUrl).toBe('https://example.com/saved');
  });

it('keeps a crawl result attached to the project selected when the run started', async () => {
    const projectId = 'project-crawl-start';
    const result = { ...createCrawlResultFixture(),
      start_url: 'https://example.com/', pages_crawled: 1, health_score: 94,
      critical_count: 0, warning_count: 1, notice_count: 0, duration_ms: 25,
      cancelled: false, timed_out: false, pages: [{ ...createCrawlPageFixture(),  url: 'https://example.com/' }],
    };
    let resolveCrawl: ((value: typeof result) => void) | undefined;
    vi.mocked(invokeTauriCommand).mockImplementation(async (command) => {
      if (command === 'crawl_site') {
        return new Promise<typeof result>((resolve) => { resolveCrawl = resolve; }) as never;
      }
      return undefined as never;
    });

    localStorage.setItem('seomi_active_project_v1', projectId);
    const pending = useToolsStore.getState().startSiteCrawl('https://example.com/', 1, undefined, 'staging', false);
    localStorage.setItem('seomi_active_project_v1', 'project-switched-during-crawl');
    resolveCrawl?.(result);
    await pending;

    const persisted = await loadCrawlRuns(projectId) as Array<{ environment?: string; result: typeof result }>;
    expect(persisted).toHaveLength(1);
    expect(persisted[0]).toMatchObject({ environment: 'staging', result: { start_url: result.start_url } });
    expect(localStorage.getItem('seomi_project_project-switched-during-crawl_crawl_runs')).toBeNull();
    expect(useToolsStore.getState().crawlRuns).toEqual([]);
  });
});
