import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createCrawlExecutionActions } from '@/stores/tools/crawl/execution';
import { useProjectStore } from '@/stores/projectStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { isolatedToolsSlice } from './fixtures/toolsSlice';
import { createCrawlPageFixture, createCrawlResultFixture, createCrawlRunFixture } from './fixtures/crawl';
const original = useSettingsStore.getState();
beforeEach(() => { localStorage.clear(); useProjectStore.setState({ activeProjectId: 'execution-direct' }); });
afterEach(() => { vi.restoreAllMocks(); useSettingsStore.setState(original); });

it('keeps execution-only resume arrays out of durable history and uses app request settings', async () => {
  useSettingsStore.setState({ config: { ...original.config, default_user_agent: 'fixture-agent', request_timeout_secs: 12,
    max_redirects: 7, verify_ssl: false } });
  const result = createCrawlResultFixture({ pages_crawled: 1, pages: [createCrawlPageFixture()] });
  const invoke = vi.fn().mockResolvedValue(result);
  const saveCrawlRuns = vi.fn().mockResolvedValue({ prunedRuns: 0 });
  const notifyCrawlCompleted = vi.fn();
  const { actions, store } = isolatedToolsSlice((set, get, services) => createCrawlExecutionActions(set, get, services),
    { invoke, saveCrawlRuns, notifyCrawlCompleted });
  store.setState({ crawlRuns: [createCrawlRunFixture({ result: { ...result, health_score: 90 } })] });
  expect(await actions.startSiteCrawl('https://example.test/', 1, { maxRedirects: undefined,
    resumeCompletedUrls: ['https://example.test/previous'], resumeFrontierUrls: ['https://example.test/next'] })).toEqual(result);
  expect(invoke).toHaveBeenCalledWith('crawl_site', expect.objectContaining({ projectId: 'execution-direct',
    config: expect.objectContaining({ maxRedirects: 7, userAgent: 'fixture-agent', requestTimeoutSecs: 12, verifySsl: false,
      resumeCompletedUrls: ['https://example.test/previous'] }) }));
  expect(saveCrawlRuns.mock.calls[0][1][0].config.resumeCompletedUrls).toBeUndefined();
  expect(saveCrawlRuns.mock.calls[0][1][0].config.resumeFrontierUrls).toBeUndefined();
  expect(notifyCrawlCompleted).toHaveBeenCalledWith('execution-direct', result, 90);
});

it('rejects an empty target and a completed snapshot with no actual pages', async () => {
  const invoke = vi.fn().mockResolvedValue(createCrawlResultFixture());
  const { actions, store } = isolatedToolsSlice((set, get, services) => createCrawlExecutionActions(set, get, services), { invoke });
  expect(await actions.startSiteCrawl('')).toBeNull();
  expect(invoke).not.toHaveBeenCalled();
  expect(await actions.startSiteCrawl('https://example.test/')).toBeNull();
  expect(store.getState().crawlError).toBeTruthy();
  expect(store.getState()).toMatchObject({ isCrawling: false, activeCrawlRunId: null });
});

it.each(['cancelled', 'timed_out'] as const)('keeps resumable evidence when a run is %s', async flag => {
  const result = createCrawlResultFixture({ pages_crawled: 1, pages: [createCrawlPageFixture()], [flag]: true });
  const { actions, store } = isolatedToolsSlice((set, get, services) => createCrawlExecutionActions(set, get, services),
    { invoke: vi.fn().mockResolvedValue(result), saveCrawlRuns: vi.fn().mockResolvedValue({ prunedRuns: 0 }),
      notifyCrawlCompleted: vi.fn() });
  await actions.startSiteCrawl('https://example.test/', 5);
  expect(store.getState().interruptedCrawl).toMatchObject({ url: 'https://example.test/', limit: 5,
    completedUrls: ['https://example.test/'], baseRunId: store.getState().selectedCrawlRunId });
});

it('merges a resumed snapshot and preserves actual prior pages', async () => {
  const base = createCrawlResultFixture({ pages_crawled: 1, pages: [createCrawlPageFixture()] });
  const { actions, store } = isolatedToolsSlice((set, get, services) => createCrawlExecutionActions(set, get, services),
    { invoke: vi.fn().mockResolvedValue(createCrawlResultFixture()), saveCrawlRuns: vi.fn().mockResolvedValue({ prunedRuns: 0 }),
      notifyCrawlCompleted: vi.fn() });
  await actions.startSiteCrawl('https://example.test/', 5, undefined, 'default', false, base);
  expect(store.getState().crawlResult?.pages).toEqual(base.pages);
  expect(store.getState().crawlResult?.pages_crawled).toBe(1);
});
