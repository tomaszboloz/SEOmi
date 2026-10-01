import { createCrawlResultFixture } from './fixtures/crawl';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { invokeTauriCommand, isTauriEnvironment } from '@/services/tauri';
import { loadCrawlRuns } from '@/services/crawlPersistence';
import { useToolsStore } from '../src/stores/toolsStore';
import { useSettingsStore } from '../src/stores/settingsStore';

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

it('deletes a saved crawl run, selects the newest remaining snapshot, and persists the freed space', async () => {
    const projectId = 'project-crawl-delete';
    localStorage.setItem('seomi_active_project_v1', projectId);
    const makeResult = (url: string) => ({ ...createCrawlResultFixture(),
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
    const partial = { ...createCrawlResultFixture(),
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
});
