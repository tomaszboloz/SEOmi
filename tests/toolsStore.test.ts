import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { invokeTauriCommand, isTauriEnvironment } from '@/services/tauri';
import { loadCrawlRuns } from '@/services/crawlPersistence';
import { useToolsStore } from '../src/stores/toolsStore';
import { useSettingsStore } from '../src/stores/settingsStore';
import { useProjectStore } from '@/stores/projectStore';
import i18n from '@/i18n';

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

  it('initializes without fabricated saved keywords or rank data', () => {
    const state = useToolsStore.getState();
    expect(state.savedKeywords).toEqual([]);
    expect(state.trackedRanks).toEqual([]);
  });

  it('keeps the active project context in memory when WebView storage is locked', () => {
    useProjectStore.setState({
      projects: [{ id: 'locked-project', name: 'Locked project', createdAt: '2026-09-24T00:00:00.000Z', lastOpenedAt: '2026-09-24T00:00:00.000Z' }],
      activeProjectId: 'locked-project',
    });
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('storage blocked'); },
      setItem: () => { throw new Error('storage blocked'); },
      removeItem: () => { throw new Error('storage blocked'); },
    });

    expect(() => useToolsStore.getState().addSavedKeyword({
      keyword: 'locked webview keyword', search_volume: 0, difficulty: 0, cpc: 0, intent: 'Informational', tags: [],
    })).not.toThrow();
    expect(useToolsStore.getState().savedKeywords[0]?.keyword).toBe('locked webview keyword');
  });

  it('hydrates the native crawl checkpoint after a desktop restart', async () => {
    const projectId = 'project-native-checkpoint';
    const checkpoint = {
      url: 'https://example.com/',
      limit: 25,
      config: { crawlMode: 'http', respectRobots: true },
      environment: 'default',
      startedAt: '2026-09-25T10:00:00.000Z',
      completedUrls: ['https://example.com/'],
      frontierUrls: ['https://example.com/about'],
      baseRunId: 'crawl-base',
    };
    localStorage.setItem('seomi_active_project_v1', projectId);
    vi.mocked(isTauriEnvironment).mockReturnValue(true);
    vi.mocked(invokeTauriCommand).mockImplementation(async (command) => {
      if (command === 'load_project_crawl_runs') return [] as never;
      if (command === 'load_project_crawl_checkpoint') return checkpoint as never;
      return undefined as never;
    });

    await useToolsStore.getState().hydrateProject(projectId);

    expect(useToolsStore.getState().interruptedCrawl).toMatchObject(checkpoint);
    expect(invokeTauriCommand).toHaveBeenCalledWith('load_project_crawl_checkpoint', { projectId });
  });

  it('keeps the fresher WebView checkpoint when the native copy is stale', async () => {
    const projectId = 'project-native-checkpoint-freshness';
    const localCheckpoint = {
      url: 'https://example.com/',
      limit: 25,
      config: { crawlMode: 'http', respectRobots: true },
      environment: 'default',
      startedAt: '2026-09-25T10:00:00.000Z',
      updatedAt: '2026-09-26T10:00:00.000Z',
      completedUrls: ['https://example.com/newer'],
      frontierUrls: ['https://example.com/newer-frontier'],
    };
    const staleNativeCheckpoint = {
      ...localCheckpoint,
      updatedAt: '2026-09-25T11:00:00.000Z',
      completedUrls: ['https://example.com/older'],
      frontierUrls: ['https://example.com/older-frontier'],
    };
    localStorage.setItem('seomi_active_project_v1', projectId);
    localStorage.setItem(`seomi_project_${projectId}_crawl_interrupted_v1`, JSON.stringify(localCheckpoint));
    vi.mocked(isTauriEnvironment).mockReturnValue(true);
    vi.mocked(invokeTauriCommand).mockImplementation(async (command) => {
      if (command === 'load_project_crawl_runs') return [] as never;
      if (command === 'load_project_crawl_checkpoint') return staleNativeCheckpoint as never;
      return undefined as never;
    });

    await useToolsStore.getState().hydrateProject(projectId);

    expect(useToolsStore.getState().interruptedCrawl?.updatedAt).toBe('2026-09-26T10:00:00.000Z');
    expect(useToolsStore.getState().interruptedCrawl?.frontierUrls).toEqual(['https://example.com/newer-frontier']);
  });

  it('can add, filter, and remove saved keywords', () => {
    const store = useToolsStore.getState();
    const initialCount = store.savedKeywords.length;

    store.addSavedKeyword({
      keyword: 'custom keyword test',
      search_volume: 1200,
      difficulty: 35,
      cpc: 1.5,
      intent: 'Informational',
      tags: ['TestTag'],
    });

    const updated = useToolsStore.getState();
    expect(updated.savedKeywords.length).toBe(initialCount + 1);
    expect(updated.savedKeywords[0].keyword).toBe('custom keyword test');

    // Remove
    const addedId = updated.savedKeywords[0].id;
    updated.removeSavedKeyword(addedId);
    expect(useToolsStore.getState().savedKeywords.length).toBe(initialCount);
  });

  it('can add a rank target without fabricating a position', async () => {
    const store = useToolsStore.getState();
    const initialCount = store.trackedRanks.length;

    store.addTrackedRank('serp tracking test', 'example.com', 'https://example.com/page', 'PL', 'pl');
    const updated = useToolsStore.getState();
    expect(updated.trackedRanks.length).toBe(initialCount + 1);

    expect(updated.trackedRanks[0].current_rank).toBeNull();
    expect(updated.trackedRanks[0].history).toEqual([]);
    expect(updated.trackedRanks[0]).toMatchObject({ location: 'PL', language_code: 'pl' });
  });

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
    const result = {
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
    const result = {
      start_url: 'https://example.com/', pages_crawled: 1, health_score: 94,
      critical_count: 0, warning_count: 1, notice_count: 0, duration_ms: 25,
      cancelled: false, timed_out: false, pages: [{ url: 'https://example.com/' }],
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

  it('does not let a stale crawl failure clear the newly selected project state', async () => {
    const originProject = 'project-crawl-error-origin';
    const selectedProject = 'project-crawl-error-selected';
    let rejectCrawl: ((reason?: unknown) => void) | undefined;
    vi.mocked(invokeTauriCommand).mockImplementation(async (command) => {
      if (command === 'crawl_site') {
        return new Promise<never>((_, reject) => { rejectCrawl = reject; }) as never;
      }
      return undefined as never;
    });

    localStorage.setItem('seomi_active_project_v1', originProject);
    const pending = useToolsStore.getState().startSiteCrawl('https://origin.example/', 1, undefined, 'default', false);

    // Simulate project hydration completing before the old native request
    // fails. The selected project's active crawl must remain untouched.
    localStorage.setItem('seomi_active_project_v1', selectedProject);
    useToolsStore.setState({
      crawlError: null,
      isCrawling: true,
      isCrawlPaused: false,
      activeCrawlRunId: 'selected-project-run',
    });
    rejectCrawl?.(new Error('origin request failed'));
    await pending;

    expect(useToolsStore.getState()).toMatchObject({
      crawlError: null,
      isCrawling: true,
      activeCrawlRunId: 'selected-project-run',
    });
  });

  it('does not clear a new project crawl when an older crawl completes', async () => {
    const originProject = 'project-crawl-complete-origin';
    const selectedProject = 'project-crawl-complete-selected';
    const result = {
      start_url: 'https://origin.example/', pages_crawled: 1, health_score: 100,
      critical_count: 0, warning_count: 0, notice_count: 0, duration_ms: 10,
      cancelled: false, timed_out: false, pages: [],
    };
    let resolveCrawl: ((value: typeof result) => void) | undefined;
    vi.mocked(invokeTauriCommand).mockImplementation(async (command) => {
      if (command === 'crawl_site') {
        return new Promise<typeof result>((resolve) => { resolveCrawl = resolve; }) as never;
      }
      return undefined as never;
    });

    localStorage.setItem('seomi_active_project_v1', originProject);
    const pending = useToolsStore.getState().startSiteCrawl('https://origin.example/', 1, undefined, 'default', false);
    localStorage.setItem('seomi_active_project_v1', selectedProject);
    useToolsStore.setState({
      crawlRuns: [],
      crawlResult: null,
      isCrawling: true,
      isCrawlPaused: false,
      activeCrawlRunId: 'selected-project-run',
      crawlProgress: 17,
    });
    resolveCrawl?.(result);
    await pending;

    expect(useToolsStore.getState()).toMatchObject({
      crawlRuns: [],
      crawlResult: null,
      isCrawling: true,
      activeCrawlRunId: 'selected-project-run',
      crawlProgress: 17,
    });
  });

  it('does not let an older same-project crawl finish over a newer run', async () => {
    const projectId = 'project-crawl-overlap';
    const result = (url: string) => ({
      start_url: url, pages_crawled: 1, health_score: 100,
      critical_count: 0, warning_count: 0, notice_count: 0, duration_ms: 10,
      cancelled: false, timed_out: false, pages: [{ url, final_url: url, issues: [], links: [] }],
    });
    const resolvers: Array<(value: ReturnType<typeof result>) => void> = [];
    vi.mocked(invokeTauriCommand).mockImplementation(async (command) => {
      if (command === 'crawl_site') {
        return new Promise<ReturnType<typeof result>>((resolve) => { resolvers.push(resolve); }) as never;
      }
      return undefined as never;
    });

    localStorage.setItem('seomi_active_project_v1', projectId);
    const first = useToolsStore.getState().startSiteCrawl('https://first.example/', 1, undefined, 'default', false);
    const firstRunId = useToolsStore.getState().activeCrawlRunId;
    const second = useToolsStore.getState().startSiteCrawl('https://second.example/', 1, undefined, 'default', false);
    const secondRunId = useToolsStore.getState().activeCrawlRunId;
    expect(secondRunId).not.toBe(firstRunId);

    resolvers[0]?.(result('https://first.example/'));
    await first;
    expect(useToolsStore.getState()).toMatchObject({ isCrawling: true, activeCrawlRunId: secondRunId });
    expect(JSON.parse(localStorage.getItem(`seomi_project_${projectId}_crawl_interrupted_v1`) || 'null')).toMatchObject({
      url: 'https://second.example/',
    });

    resolvers[1]?.(result('https://second.example/'));
    await second;
    expect(useToolsStore.getState().activeCrawlRunId).toBeNull();
    expect(useToolsStore.getState().crawlResult?.start_url).toBe('https://second.example/');
    expect(localStorage.getItem(`seomi_project_${projectId}_crawl_interrupted_v1`)).toBeNull();
  });

  it('persists explicit environment labels for paired staging and production runs', async () => {
    localStorage.setItem('seomi_active_project_v1', 'project-environments');
    const result = {
      start_url: 'https://example.com/', pages_crawled: 1, health_score: 100,
      critical_count: 0, warning_count: 0, notice_count: 0, duration_ms: 10,
      cancelled: false, timed_out: false, pages: [{ url: 'https://example.com/' }],
    };
    vi.mocked(invokeTauriCommand).mockResolvedValue(result as never);

    await useToolsStore.getState().startSiteCrawl('https://staging.example.com/', 1, undefined, 'staging', false);
    await useToolsStore.getState().startSiteCrawl('https://example.com/', 1, undefined, 'production', false);

    expect(useToolsStore.getState().crawlRuns.map((run) => run.environment)).toEqual(['production', 'staging']);
    expect((await loadCrawlRuns('project-environments')).map((run) => run.environment)).toEqual(['production', 'staging']);
  });

  it('keeps older same-URL snapshots when importing a scheduled crawl handoff', async () => {
    const projectId = 'project-scheduled-crawl-history';
    localStorage.setItem('seomi_active_project_v1', projectId);
    const olderResult = {
      start_url: 'https://example.com/', pages_crawled: 1, health_score: 92,
      critical_count: 0, warning_count: 2, notice_count: 0, duration_ms: 12,
      cancelled: false, timed_out: false, pages: [],
    };
    const scheduledResult = {
      ...olderResult, health_score: 98, warning_count: 1, duration_ms: 18,
    };
    useToolsStore.setState({
      crawlRuns: [{
        id: 'manual-snapshot', completedAt: '2026-09-24T10:00:00.000Z',
        startUrl: olderResult.start_url, config: {}, result: olderResult,
      } as never],
      crawlResult: olderResult as never,
      selectedCrawlRunId: 'manual-snapshot',
    });

    const imported = await useToolsStore.getState().importScheduledCrawlResult(
      scheduledResult,
      'schedule-1-2026-09-25T10-00-00Z',
    );

    expect(imported).toBe(true);
    expect(useToolsStore.getState().crawlRuns.map((run) => run.id)).toEqual([
      'scheduled-crawl-schedule-1-2026-09-25T10-00-00Z',
      'manual-snapshot',
    ]);
    expect((await loadCrawlRuns(projectId)).map((run) => run.id)).toEqual([
      'scheduled-crawl-schedule-1-2026-09-25T10-00-00Z',
      'manual-snapshot',
    ]);
  });

  it('persists an interrupted crawl descriptor and offers it after project hydration', async () => {
    const projectId = 'project-interrupted-crawl';
    localStorage.setItem('seomi_active_project_v1', projectId);
    vi.mocked(invokeTauriCommand).mockRejectedValueOnce(new Error('temporary network failure'));

    await useToolsStore.getState().startSiteCrawl('https://example.com/', 12, { maxRunSeconds: 90 }, 'staging', false);

    const key = `seomi_project_${projectId}_crawl_interrupted_v1`;
    expect(JSON.parse(localStorage.getItem(key) || 'null')).toMatchObject({
      url: 'https://example.com/',
      limit: 12,
      environment: 'staging',
      config: { maxRunSeconds: 90 },
    });
    expect(useToolsStore.getState().interruptedCrawl?.url).toBe('https://example.com/');

    await useToolsStore.getState().hydrateProject(projectId);
    expect(useToolsStore.getState().interruptedCrawl).toMatchObject({ limit: 12, environment: 'staging' });

    useToolsStore.getState().discardInterruptedCrawl();
    expect(localStorage.getItem(key)).toBeNull();
    expect(useToolsStore.getState().interruptedCrawl).toBeNull();
  });

  it('localizes a storage quota returned by the crawler and keeps the resume checkpoint', async () => {
    const projectId = 'project-crawl-quota-error';
    localStorage.setItem('seomi_active_project_v1', projectId);
    vi.mocked(invokeTauriCommand).mockRejectedValueOnce(new Error('The quota has been exceeded.'));

    await useToolsStore.getState().startSiteCrawl('https://example.com/', 12, undefined, 'default', false);

    expect(useToolsStore.getState().crawlError).toBe(i18n.t('runtimeErrors.persistence.localQuota'));
    expect(useToolsStore.getState().interruptedCrawl).toMatchObject({
      url: 'https://example.com/',
      limit: 12,
    });
    expect(JSON.parse(localStorage.getItem(`seomi_project_${projectId}_crawl_interrupted_v1`) || 'null')).toMatchObject({
      url: 'https://example.com/',
    });
  });

  it.each([
    ['cancel_site_crawl', 'cancelSiteCrawl'],
    ['pause_site_crawl', 'pauseSiteCrawl'],
    ['resume_site_crawl', 'resumeSiteCrawl'],
  ] as const)('localizes quota errors from %s control commands', async (command, action) => {
    const projectId = 'project-crawl-control-quota';
    localStorage.setItem('seomi_active_project_v1', projectId);
    useToolsStore.setState({
      activeCrawlRunId: 'crawl-control-quota',
      isCrawling: true,
      isCrawlPaused: action === 'resumeSiteCrawl',
      crawlError: null,
    });
    vi.mocked(invokeTauriCommand).mockRejectedValueOnce(new Error('The quota has been exceeded.'));

    await useToolsStore.getState()[action]();

    expect(invokeTauriCommand).toHaveBeenCalledWith(command, { runId: 'crawl-control-quota' });
    expect(useToolsStore.getState().crawlError).toBe(i18n.t('runtimeErrors.persistence.localQuota'));
    useToolsStore.setState({ activeCrawlRunId: null, isCrawling: false, isCrawlPaused: false });
  });

  it('can retry persisting a completed in-memory crawl after a storage failure', async () => {
    const projectId = 'project-persistence-retry';
    localStorage.setItem('seomi_active_project_v1', projectId);
    const result = {
      start_url: 'https://example.com/', pages_crawled: 1, health_score: 100,
      critical_count: 0, warning_count: 0, notice_count: 0, duration_ms: 12,
      cancelled: false, timed_out: false, pages: [],
    };
    const run = { id: 'retry-run', completedAt: new Date().toISOString(), startUrl: result.start_url, config: {}, result };
    useToolsStore.setState({ crawlRuns: [run as never], crawlResult: result as never, crawlPersistenceError: 'Pamięć lokalna jest pełna.' });

    await useToolsStore.getState().retryCrawlPersistence();

    expect(useToolsStore.getState().crawlPersistenceError).toBeNull();
    expect(useToolsStore.getState().isRetryingCrawlPersistence).toBe(false);
    expect((await loadCrawlRuns(projectId)).map((item) => item.id)).toEqual(['retry-run']);
  });

  it('deletes a saved crawl run, selects the newest remaining snapshot, and persists the freed space', async () => {
    const projectId = 'project-crawl-delete';
    localStorage.setItem('seomi_active_project_v1', projectId);
    const makeResult = (url: string) => ({
      start_url: url, pages_crawled: 1, health_score: 100,
      critical_count: 0, warning_count: 0, notice_count: 0, duration_ms: 12,
      cancelled: false, timed_out: false, pages: [],
    });
    const newest = { id: 'newest-run', completedAt: '2026-09-24T10:00:00.000Z', startUrl: 'https://example.com/new', config: {}, result: makeResult('https://example.com/new') };
    const older = { id: 'older-run', completedAt: '2026-09-23T10:00:00.000Z', startUrl: 'https://example.com/old', config: {}, result: makeResult('https://example.com/old') };
    useToolsStore.setState({ crawlRuns: [newest as never, older as never], crawlResult: older.result as never, selectedCrawlRunId: older.id, crawlPersistenceError: null });

    await useToolsStore.getState().deleteCrawlRun(older.id);

    expect(useToolsStore.getState().crawlRuns.map((run) => run.id)).toEqual(['newest-run']);
    expect(useToolsStore.getState().selectedCrawlRunId).toBe('newest-run');
    expect(useToolsStore.getState().crawlResult?.start_url).toBe(newest.startUrl);
    expect((await loadCrawlRuns(projectId)).map((run) => run.id)).toEqual(['newest-run']);
    expect(useToolsStore.getState().crawlPersistenceError).toBeNull();
  });

  it('does not delete crawl history while a crawl is active', async () => {
    localStorage.setItem('seomi_active_project_v1', 'project-crawl-active');
    const run = { id: 'active-history-run', result: { start_url: 'https://example.com/' } };
    useToolsStore.setState({ crawlRuns: [run as never], isCrawling: true, crawlPersistenceError: null });

    await useToolsStore.getState().deleteCrawlRun(run.id);

    expect(useToolsStore.getState().crawlRuns).toHaveLength(1);
    expect(useToolsStore.getState().crawlPersistenceError).toBe(i18n.t('runtimeErrors.tools.activeCrawlDelete'));
  });

  it('stores a bounded crawl checkpoint and resumes without refetching completed pages', async () => {
    const projectId = 'project-crawl-checkpoint';
    localStorage.setItem('seomi_active_project_v1', projectId);
    const partial = {
      start_url: 'https://example.com/', pages_crawled: 2, health_score: 100,
      critical_count: 0, warning_count: 0, notice_count: 0, duration_ms: 20,
      cancelled: true, timed_out: false,
      sitemap_urls: ['https://example.com/sitemap-page'], sitemap_urls_discovered: 1,
      pages: [
        { url: 'https://example.com/', final_url: 'https://example.com/', issues: [], links: [{ target_url: 'https://example.com/new', anchor_text: 'New' }] },
        { url: 'https://example.com/old', final_url: 'https://example.com/old', issues: [], links: [] },
      ],
    };
    vi.mocked(invokeTauriCommand).mockResolvedValueOnce(partial as never);

    await useToolsStore.getState().startSiteCrawl('https://example.com/', 10, undefined, 'default', false);

    const key = `seomi_project_${projectId}_crawl_interrupted_v1`;
    const descriptor = JSON.parse(localStorage.getItem(key) || 'null');
    expect(descriptor.completedUrls).toEqual(expect.arrayContaining(['https://example.com/', 'https://example.com/old']));
    expect(descriptor.frontierUrls).toEqual(expect.arrayContaining(['https://example.com/new', 'https://example.com/sitemap-page']));
    expect(descriptor.baseRunId).toBe(useToolsStore.getState().crawlRuns[0].id);

    const resumed = {
      ...partial,
      cancelled: false,
      pages_crawled: 1,
      pages: [{ url: 'https://example.com/new', final_url: 'https://example.com/new', issues: [], links: [] }],
      sitemap_urls: [], sitemap_urls_discovered: 0,
    };
    vi.mocked(invokeTauriCommand).mockResolvedValueOnce(resumed as never);

    const result = await useToolsStore.getState().resumeInterruptedCrawl();

    const crawlCalls = vi.mocked(invokeTauriCommand).mock.calls.filter(([command]) => command === 'crawl_site');
    const crawlCall = crawlCalls[crawlCalls.length - 1];
    expect(crawlCall?.[1]).toMatchObject({ config: {
      resumeCompletedUrls: expect.arrayContaining(['https://example.com/', 'https://example.com/old']),
      resumeFrontierUrls: expect.arrayContaining(['https://example.com/new']),
    } });
    expect(result?.pages.map((page) => page.final_url)).toEqual(expect.arrayContaining([
      'https://example.com/', 'https://example.com/old', 'https://example.com/new',
    ]));
    expect(useToolsStore.getState().interruptedCrawl).toBeNull();
  });

  it('persists the explicit crawl host allowlist per project', () => {
    const projectId = 'project-crawl-scope';
    localStorage.setItem('seomi_active_project_v1', projectId);
    useToolsStore.getState().hydrateProject(projectId);

    expect(useToolsStore.getState().crawlConfig.maxConcurrentRequests).toBe(4);
    useToolsStore.getState().setCrawlConfig({ allowedHosts: ['docs.example.com', 'cdn.example.net'], focusPhrase: 'technical SEO audit' });

    expect(useToolsStore.getState().crawlConfig.allowedHosts).toEqual(['docs.example.com', 'cdn.example.net']);
    expect(useToolsStore.getState().crawlConfig.focusPhrase).toBe('technical SEO audit');
    expect(JSON.parse(localStorage.getItem(`seomi_project_${projectId}_crawl_settings`) || '{}').config.allowedHosts)
      .toEqual(['docs.example.com', 'cdn.example.net']);
    expect(JSON.parse(localStorage.getItem(`seomi_project_${projectId}_crawl_settings`) || '{}').config.focusPhrase)
      .toBe('technical SEO audit');

    localStorage.setItem('seomi_active_project_v1', 'other-crawl-scope-project');
    useToolsStore.getState().hydrateProject('other-crawl-scope-project');
    expect(useToolsStore.getState().crawlConfig.allowedHosts).toEqual([]);
    expect(useToolsStore.getState().crawlConfig.focusPhrase).toBe('');
  });

  it('persists backlink-gap inputs per project without leaking competitors between projects', () => {
    localStorage.setItem('seomi_active_project_v1', 'project-one');
    useToolsStore.getState().hydrateProject('project-one');
    useToolsStore.getState().setBacklinkGapCompetitors(['one.example', 'two.example']);
    useToolsStore.getState().setBacklinkGapIncludeSubdomains(false);
    expect(JSON.parse(localStorage.getItem('seomi_backlink_gap_settings_project-one') || '{}')).toEqual({
      competitors: ['one.example', 'two.example'], includeSubdomains: false,
    });

    localStorage.setItem('seomi_active_project_v1', 'project-two');
    useToolsStore.getState().hydrateProject('project-two');
    expect(useToolsStore.getState().backlinkGapCompetitors).toEqual([]);
    expect(useToolsStore.getState().backlinkGapIncludeSubdomains).toBe(true);

    localStorage.setItem('seomi_active_project_v1', 'project-one');
    useToolsStore.getState().hydrateProject('project-one');
    expect(useToolsStore.getState().backlinkGapCompetitors).toEqual(['one.example', 'two.example']);
    expect(useToolsStore.getState().backlinkGapIncludeSubdomains).toBe(false);
  });

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

  it('hydrates bounded backlink profile history per project and preserves null metrics', async () => {
    const projectId = 'project-backlink-history';
    localStorage.setItem('seomi_active_project_v1', projectId);
    const history = [
      {
        domain: 'example.com', retrieved_at: '2026-09-20T12:00:00.000Z', total_backlinks: 100,
        referring_domains: 10, domain_rank: 20, dofollow_ratio: null,
      },
      {
        domain: 'example.com', retrieved_at: '2026-09-21T12:00:00.000Z', total_backlinks: 140,
        referring_domains: 12, domain_rank: 22, dofollow_ratio: 65.5,
      },
      { domain: 'other.example', retrieved_at: '2026-09-21T12:00:00.000Z', total_backlinks: 1, referring_domains: 1, domain_rank: 1, dofollow_ratio: 100 },
      { domain: 'invalid.example', retrieved_at: 42, total_backlinks: 1, referring_domains: 1, domain_rank: 1, dofollow_ratio: 100 },
    ];
    localStorage.setItem(`seomi_project_${projectId}_backlink_profile_history_v1`, JSON.stringify(history));

    await useToolsStore.getState().hydrateProject(projectId);

    expect(useToolsStore.getState().backlinkProfileHistory).toHaveLength(3);
    expect(useToolsStore.getState().backlinkProfileHistory[0].dofollow_ratio).toBeNull();
    expect(useToolsStore.getState().backlinkProfileHistory[1].total_backlinks).toBe(140);
  });

  it('does not apply a live domain response after the active project changes', async () => {
    const firstProject = 'project-live-one';
    const secondProject = 'project-live-two';
    useProjectStore.setState({
      projects: [
        { id: firstProject, name: 'Live one', rootUrl: 'https://one.example', createdAt: '2026-09-24T00:00:00.000Z', lastOpenedAt: '2026-09-24T00:00:00.000Z' },
        { id: secondProject, name: 'Live two', rootUrl: 'https://two.example', createdAt: '2026-09-24T00:00:00.000Z', lastOpenedAt: '2026-09-24T00:00:00.000Z' },
      ],
      activeProjectId: firstProject,
    });
    localStorage.setItem('seomi_active_project_v1', firstProject);
    useSettingsStore.setState({ dataForSeoCredentials: { login: 'user', password: 'secret' } });

    let releaseFirstRequest: ((response: Response) => void) | undefined;
    let firstRequest = true;
    const fetchMock = vi.fn((input: string) => {
      const url = String(input);
      const items = url.includes('/domain_rank_overview/') ? [{ metrics: { organic: { etv: 1200, count: 60 } } }] : [];
      const result = url.includes('/backlinks/summary/')
        ? [{ backlinks: 40, referring_domains: 8, rank: 25, dofollow: 20, broken_backlinks: 0 }]
        : [{ items }];
      const response = new Response(JSON.stringify({ tasks: [{ status_code: 20000, result }] }), { status: 200 });
      if (firstRequest) {
        firstRequest = false;
        return new Promise<Response>((resolve) => { releaseFirstRequest = resolve; });
      }
      return Promise.resolve(response);
    });
    vi.stubGlobal('fetch', fetchMock);

    const pending = useToolsStore.getState().analyzeDomain('one.example');
    localStorage.setItem('seomi_active_project_v1', secondProject);
    useProjectStore.setState({ activeProjectId: secondProject });
    await useToolsStore.getState().hydrateProject(secondProject);
    releaseFirstRequest?.(new Response(JSON.stringify({ tasks: [{ status_code: 20000, result: [{ items: [{ metrics: { organic: { etv: 1200, count: 60 } } }] }] }] }), { status: 200 }));
    await pending;

    expect(useToolsStore.getState().domainOverview).toBeNull();
    expect(useToolsStore.getState().domainError).toBeNull();
  });

  it('does not let a stale backlink page overwrite a newer profile request in the same project', async () => {
    const projectId = 'project-backlink-request-order';
    useProjectStore.setState({
      projects: [{ id: projectId, name: 'Backlink order', rootUrl: 'https://example.com', createdAt: '2026-09-24T00:00:00.000Z', lastOpenedAt: '2026-09-24T00:00:00.000Z' }],
      activeProjectId: projectId,
    });
    localStorage.setItem('seomi_active_project_v1', projectId);
    useSettingsStore.setState({ dataForSeoCredentials: { login: 'user', password: 'secret' } });
    useToolsStore.setState({
      backlinkProfile: {
        domain: 'example.com', total_backlinks: 2, referring_domains: 1, referring_subnets: 1, domain_rank: 10,
        dofollow_ratio: 100, total_anchor_rows: 1, total_backlink_rows: 2,
        anchors: [{ anchor: 'old', count: 1, percentage: 50 }],
        backlinks: [{ source_title: 'Existing', source_url: 'https://existing.example/', target_url: 'https://example.com/', anchor_text: 'old', is_dofollow: true, domain_rank: 10, first_seen: '2026-01-01' }],
      },
      isBacklinkLoading: false,
    });

    let releaseStalePage!: (response: Response) => void;
    let backlinkPageCalls = 0;
    const response = (result: Record<string, unknown>[]) => new Response(JSON.stringify({ tasks: [{ status_code: 20000, result }] }), { status: 200 });
    const fetchMock = vi.fn((input: string) => {
      const url = String(input);
      if (url.includes('/backlinks/backlinks/')) {
        backlinkPageCalls += 1;
        if (backlinkPageCalls === 1) {
          return new Promise<Response>((resolve) => { releaseStalePage = resolve; });
        }
        return Promise.resolve(response([{ total_count: 2, items: [{ title: 'Fresh', url_from: 'https://fresh.example/', url_to: 'https://example.com/', anchor: 'fresh', dofollow: true, rank: 25, first_seen: '2026-02-01' }] }]));
      }
      if (url.includes('/backlinks/summary/')) {
        return Promise.resolve(response([{ backlinks: 2, referring_domains: 1, referring_main_domains: 1, rank: 15, dofollow: 2, broken_backlinks: 0 }]));
      }
      if (url.includes('/backlinks/anchors/')) {
        return Promise.resolve(response([{ total_count: 1, referring_subnets: 1, items: [{ anchor: 'fresh', backlinks: 2 }] }]));
      }
      return Promise.resolve(response([]));
    });
    vi.stubGlobal('fetch', fetchMock);

    const stalePage = useToolsStore.getState().loadMoreBacklinks();
    await Promise.resolve();
    const freshProfile = useToolsStore.getState().analyzeBacklinks('example.com');
    await freshProfile;

    expect(useToolsStore.getState().backlinkProfile?.backlinks).toHaveLength(1);
    expect(useToolsStore.getState().backlinkProfile?.backlinks[0]?.source_url).toBe('https://fresh.example/');

    releaseStalePage(response([{ total_count: 2, items: [{ title: 'Stale', url_from: 'https://stale.example/', url_to: 'https://example.com/', anchor: 'stale', dofollow: true, rank: 5, first_seen: '2026-01-15' }] }]));
    await stalePage;

    expect(useToolsStore.getState().backlinkProfile?.backlinks).toHaveLength(1);
    expect(useToolsStore.getState().backlinkProfile?.backlinks[0]?.source_url).toBe('https://fresh.example/');
    expect(useToolsStore.getState().isBacklinkLoading).toBe(false);
  });

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
    localStorage.setItem('seomi_saved_keywords', JSON.stringify([{ id: 'legacy-keyword', keyword: 'real record' }]));
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

  it('persists the rank tracking draft per project, including the full market and language selection', async () => {
    const firstProject = 'project-rank-draft-one';
    const secondProject = 'project-rank-draft-two';
    useProjectStore.setState({
      projects: [
        { id: firstProject, name: 'Rank one', rootUrl: 'https://one.example', createdAt: '2026-09-24T00:00:00.000Z', lastOpenedAt: '2026-09-24T00:00:00.000Z' },
        { id: secondProject, name: 'Rank two', rootUrl: 'https://two.example', createdAt: '2026-09-24T00:00:00.000Z', lastOpenedAt: '2026-09-24T00:00:00.000Z' },
      ],
      activeProjectId: firstProject,
    });
    localStorage.setItem('seomi_active_project_v1', firstProject);

    await useToolsStore.getState().hydrateProject(firstProject);
    useToolsStore.getState().setRankTrackingDraft({
      keyword: 'technical seo',
      domain: 'example.com',
      targetUrl: 'https://example.com/seo',
      location: 'PL',
      language: 'pl',
    });
    expect(JSON.parse(localStorage.getItem(`seomi_project_${firstProject}_rank_tracking_draft_v1`) || '{}')).toMatchObject({
      keyword: 'technical seo', domain: 'example.com', targetUrl: 'https://example.com/seo', location: 'PL', language: 'pl',
    });

    localStorage.setItem('seomi_active_project_v1', secondProject);
    useProjectStore.setState({ activeProjectId: secondProject });
    await useToolsStore.getState().hydrateProject(secondProject);
    expect(useToolsStore.getState().rankTrackingDraft).toEqual({ keyword: '', domain: '', targetUrl: '', location: 'US', language: 'en' });

    localStorage.setItem('seomi_active_project_v1', firstProject);
    useProjectStore.setState({ activeProjectId: firstProject });
    await useToolsStore.getState().hydrateProject(firstProject);
    expect(useToolsStore.getState().rankTrackingDraft).toEqual({
      keyword: 'technical seo', domain: 'example.com', targetUrl: 'https://example.com/seo', location: 'PL', language: 'pl',
    });
  });

  it('does not apply a request profile result after switching projects', async () => {
    const firstProject = 'project-profile-source';
    const secondProject = 'project-profile-target';
    localStorage.setItem('seomi_active_project_v1', firstProject);
    useToolsStore.setState({ crawlRequestProfiles: [], isSavingCrawlRequestProfile: false });
    let resolveSave!: (value: unknown) => void;
    vi.mocked(invokeTauriCommand).mockReturnValue(new Promise((resolve) => { resolveSave = resolve; }) as never);

    const pending = useToolsStore.getState().saveCrawlRequestProfile({
      name: 'Authenticated crawl', userAgent: 'SeomiBot/1.0', headers: [], cookie: '', proxyUrl: '',
    });
    await Promise.resolve();
    localStorage.setItem('seomi_active_project_v1', secondProject);
    useToolsStore.setState({ crawlRequestProfiles: [], isSavingCrawlRequestProfile: true });
    resolveSave(undefined);
    await pending;

    expect(useToolsStore.getState().crawlRequestProfiles).toEqual([]);
    expect(useToolsStore.getState().isSavingCrawlRequestProfile).toBe(true);
    expect(invokeTauriCommand).toHaveBeenCalledWith('save_crawl_auth_profile', expect.objectContaining({ projectId: firstProject }));
    expect(localStorage.getItem(`seomi_project_${secondProject}_crawl_request_profiles_v1`)).toBeNull();
  });

  it('does not remove a request profile from the newly selected project', async () => {
    const firstProject = 'project-profile-delete-source';
    const secondProject = 'project-profile-delete-target';
    localStorage.setItem('seomi_active_project_v1', firstProject);
    useToolsStore.setState({ crawlRequestProfiles: [{ id: 'profile-1', name: 'Source', userAgent: '', hasProxy: false, hasHeaders: false, hasCookie: false, createdAt: '2026-09-24T00:00:00.000Z', updatedAt: '2026-09-24T00:00:00.000Z' }] as never });
    let resolveDelete!: (value: unknown) => void;
    vi.mocked(invokeTauriCommand).mockReturnValue(new Promise((resolve) => { resolveDelete = resolve; }) as never);

    const pending = useToolsStore.getState().deleteCrawlRequestProfile('profile-1');
    await Promise.resolve();
    localStorage.setItem('seomi_active_project_v1', secondProject);
    useToolsStore.setState({ crawlRequestProfiles: [{ id: 'profile-1', name: 'Target', userAgent: '', hasProxy: false, hasHeaders: false, hasCookie: false, createdAt: '2026-09-24T00:00:00.000Z', updatedAt: '2026-09-24T00:00:00.000Z' }] as never });
    resolveDelete(undefined);
    await pending;

    expect(useToolsStore.getState().crawlRequestProfiles[0]?.name).toBe('Target');
    expect(invokeTauriCommand).toHaveBeenCalledWith('delete_crawl_auth_profile', { projectId: firstProject, profileId: 'profile-1' });
    expect(localStorage.getItem(`seomi_project_${secondProject}_crawl_request_profiles_v1`)).toBeNull();
  });
  it('derives all new-request defaults from a Polish project and shares an explicitly selected market', async () => {
    const previous = useProjectStore.getState();
    localStorage.setItem('seomi_active_project_v1', 'market-project');
    useProjectStore.setState({ activeProjectId: 'market-project', projects: [{ id: 'market-project', name: 'Polish site', rootUrl: 'https://example.pl', createdAt: '2026-10-01', lastOpenedAt: '2026-10-01' }] });
    await useToolsStore.getState().hydrateProject('market-project');
    expect(useToolsStore.getState()).toMatchObject({ keywordCountry: 'PL', domainCountry: 'PL', rankTrackingDraft: { location: 'PL', language: 'pl' } });
    useToolsStore.getState().setDomainCountry('DE');
    expect(useToolsStore.getState()).toMatchObject({ keywordCountry: 'DE', domainCountry: 'DE', rankTrackingDraft: { location: 'DE' } });
    expect(localStorage.getItem('seomi_project_market-project_dataforseo_market_v1')).toBe('DE');
    await useToolsStore.getState().hydrateProject('market-project');
    expect(useToolsStore.getState().keywordCountry).toBe('DE');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await useToolsStore.getState().analyzeDomain('example.pl', 'invalid-country');
    expect(useToolsStore.getState().domainError).toBe(i18n.t('runtimeErrors.dataforseo.marketRequired'));
    expect(fetchMock).not.toHaveBeenCalled();
    useProjectStore.setState(previous);
  });

  it('records a successful absent rank as outside the top 100 instead of not checked', async () => {
    localStorage.setItem('seomi_active_project_v1', 'rank-project');
    useToolsStore.setState({ trackedRanks: [] });
    useToolsStore.getState().addTrackedRank('seo audit', 'example.pl', 'https://example.pl', 'PL', 'pl');
    useSettingsStore.setState({ dataForSeoCredentials: { login: 'login', password: 'password' } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ tasks: [{ status_code: 20000, result: [{ items: [] }] }] }))));
    await useToolsStore.getState().refreshAllRanks();
    expect(useToolsStore.getState().trackedRanks[0]).toMatchObject({ current_rank: 101, last_checked: expect.any(String), best_rank: null });
    useToolsStore.setState({ trackedRanks: [] });
  });

});
