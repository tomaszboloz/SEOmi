import { beforeEach, expect, it, vi } from 'vitest';
import { createCrawlExecutionActions } from '@/stores/tools/crawl/execution';
import { useProjectStore } from '@/stores/projectStore';
import { isolatedToolsSlice } from './fixtures/toolsSlice';
import { createCrawlPageFixture, createCrawlResultFixture } from './fixtures/crawl';
const result = createCrawlResultFixture({ pages: [createCrawlPageFixture()], pages_crawled: 1 });
beforeEach(() => { localStorage.clear(); useProjectStore.setState({ activeProjectId: 'execution-edges' }); });

it('runs without a project without persisting or notifying another project', async () => {
  useProjectStore.setState({ activeProjectId: null });
  const saveCrawlRuns = vi.fn();
  const notifyCrawlCompleted = vi.fn();
  const { actions, store } = isolatedToolsSlice((set, get, services) => createCrawlExecutionActions(set, get, services),
    { invoke: vi.fn().mockResolvedValue(result), saveCrawlRuns, notifyCrawlCompleted });
  expect(await actions.startSiteCrawl('https://example.test/')).toEqual(result);
  expect(store.getState().crawlResult).toEqual(result);
  expect(saveCrawlRuns).not.toHaveBeenCalled();
  expect(notifyCrawlCompleted).not.toHaveBeenCalled();
});

it.each([new Error('save failure'), new DOMException('quota', 'QuotaExceededError'), 'unstructured save failure'])(
  'keeps a completed result inspectable when history save fails: %s', async error => {
    const { actions, store } = isolatedToolsSlice((set, get, services) => createCrawlExecutionActions(set, get, services),
      { invoke: vi.fn().mockResolvedValue(result), saveCrawlRuns: vi.fn().mockRejectedValue(error), notifyCrawlCompleted: vi.fn() });
    expect(await actions.startSiteCrawl('https://example.test/')).toEqual(result);
    expect(store.getState().crawlResult).toEqual(result);
    expect(store.getState().crawlPersistenceError).toBeTruthy();
    expect(store.getState().crawlError).toBeNull();
  },
);

it('does not expose a background save failure in the newly active project', async () => {
  const saveCrawlRuns = vi.fn(async () => { useProjectStore.setState({ activeProjectId: 'other' }); throw new Error('old save'); });
  const { actions, store } = isolatedToolsSlice((set, get, services) => createCrawlExecutionActions(set, get, services),
    { invoke: vi.fn().mockResolvedValue(result), saveCrawlRuns, notifyCrawlCompleted: vi.fn() });
  await actions.startSiteCrawl('https://example.test/');
  expect(store.getState().crawlPersistenceError).toBeNull();
});

it('ignores a failed old native run after switching projects', async () => {
  const invoke = vi.fn(async () => { useProjectStore.setState({ activeProjectId: 'other' }); throw new Error('old crawl'); });
  const { actions, store } = isolatedToolsSlice((set, get, services) => createCrawlExecutionActions(set, get, services), { invoke });
  expect(await actions.startSiteCrawl('https://example.test/')).toBeNull();
  expect(store.getState().crawlError).toBeNull();
});

it('uses the configured target and explicit agent when called without URL arguments', async () => {
  const invoke = vi.fn().mockResolvedValue(result);
  const { actions, store } = isolatedToolsSlice((set, get, services) => createCrawlExecutionActions(set, get, services),
    { invoke, saveCrawlRuns: vi.fn().mockResolvedValue({ prunedRuns: 0 }), notifyCrawlCompleted: vi.fn() });
  store.setState({ crawlUrl: ' https://example.test/configured ', crawlLimit: 15 });
  expect(await actions.startSiteCrawl(undefined, undefined, { userAgent: 'custom-agent' })).toEqual(result);
  expect(invoke).toHaveBeenCalledWith('crawl_site', expect.objectContaining({ startUrl: 'https://example.test/configured',
    maxPages: 15, config: expect.objectContaining({ userAgent: 'custom-agent' }) }));
});

it('contains a projectless native failure without creating a project checkpoint', async () => {
  useProjectStore.setState({ activeProjectId: null });
  const { actions, store } = isolatedToolsSlice((set, get, services) => createCrawlExecutionActions(set, get, services),
    { invoke: vi.fn().mockRejectedValue(new Error('native failure')) });
  expect(await actions.startSiteCrawl('https://example.test/')).toBeNull();
  expect(store.getState().crawlError).toBe('native failure');
  expect(localStorage.length).toBe(0);
});
