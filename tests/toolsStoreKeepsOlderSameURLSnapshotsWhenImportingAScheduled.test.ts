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

it('keeps older same-URL snapshots when importing a scheduled crawl handoff', async () => {
    const projectId = 'project-scheduled-crawl-history';
    localStorage.setItem('seomi_active_project_v1', projectId);
    const olderResult = { ...createCrawlResultFixture(),
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
    const result = { ...createCrawlResultFixture(),
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
});
