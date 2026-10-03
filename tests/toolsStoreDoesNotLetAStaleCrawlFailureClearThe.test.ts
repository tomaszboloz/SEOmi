import { createCrawlPageFixture, createCrawlResultFixture } from './fixtures/crawl';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { invokeTauriCommand, isTauriEnvironment } from '@/services/tauri';
import { loadCrawlRuns } from '@/services/crawlPersistence';
import { useToolsStore } from '../src/stores/toolsStore';
import { useSettingsStore } from '../src/stores/settingsStore';

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
    const result = { ...createCrawlResultFixture(),
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
    const result = (url: string) => ({ ...createCrawlResultFixture(),
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
    const result = { ...createCrawlResultFixture(),
      start_url: 'https://example.com/', pages_crawled: 1, health_score: 100,
      critical_count: 0, warning_count: 0, notice_count: 0, duration_ms: 10,
      cancelled: false, timed_out: false, pages: [{ ...createCrawlPageFixture(),  url: 'https://example.com/' }],
    };
    vi.mocked(invokeTauriCommand).mockResolvedValue(result as never);

    await useToolsStore.getState().startSiteCrawl('https://staging.example.com/', 1, undefined, 'staging', false);
    await useToolsStore.getState().startSiteCrawl('https://example.com/', 1, undefined, 'production', false);

    expect(useToolsStore.getState().crawlRuns.map((run) => run.environment)).toEqual(['production', 'staging']);
    expect((await loadCrawlRuns('project-environments')).map((run) => run.environment)).toEqual(['production', 'staging']);
  });
});
