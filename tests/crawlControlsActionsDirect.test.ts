import { beforeEach, expect, it, vi } from 'vitest';
import { createCrawlControlsActions } from '@/stores/tools/crawl/controls';
import { useProjectStore } from '@/stores/projectStore';
import { DEFAULT_CRAWL_CONFIG } from '@/stores/tools/crawlPersistence';
import { isolatedToolsSlice } from './fixtures/toolsSlice';
import { createCrawlRunFixture } from './fixtures/crawl';
const methods = ['cancelSiteCrawl', 'pauseSiteCrawl', 'resumeSiteCrawl'] as const;
beforeEach(() => { localStorage.clear(); useProjectStore.setState({ activeProjectId: 'control-direct' }); });
const setup = (invoke = vi.fn().mockResolvedValue(undefined)) => {
  const slice = isolatedToolsSlice((set, get, services) => createCrawlControlsActions(set, get, services), { invoke });
  slice.store.setState({ activeCrawlRunId: 'run', isCrawling: true });
  return { ...slice, invoke };
};

it.each(methods)('sends the correct run identifier through %s', async method => {
  const { actions, store, invoke } = setup();
  store.setState({ isCrawlPaused: method === 'resumeSiteCrawl' });
  await actions[method]();
  const command = { cancelSiteCrawl: 'cancel_site_crawl', pauseSiteCrawl: 'pause_site_crawl', resumeSiteCrawl: 'resume_site_crawl' }[method];
  expect(invoke).toHaveBeenCalledWith(command, { runId: 'run' });
  expect(store.getState().isCrawlPaused).toBe(method === 'pauseSiteCrawl');
  expect(store.getState().crawlProgressDetail).toBeNull();
});

it.each(['pauseSiteCrawl', 'resumeSiteCrawl'] as const)('updates existing progress telemetry through %s', async method => {
  const { actions, store } = setup();
  store.setState({ isCrawlPaused: method === 'resumeSiteCrawl', crawlProgressDetail: {
    runId: 'run', discovered: 5, completed: 2, queued: 3, cancelled: false, paused: method === 'resumeSiteCrawl',
    elapsedMs: 10, pagesPerSecond: 2,
  } });
  await actions[method]();
  expect(store.getState().crawlProgressDetail).toMatchObject({ completed: 2, paused: method === 'pauseSiteCrawl' });
});

it.each(methods)('skips %s without an active run', async method => {
  const { actions, store, invoke } = setup();
  store.setState({ activeCrawlRunId: null });
  await actions[method]();
  expect(invoke).not.toHaveBeenCalled();
});

it.each(methods)('contains %s failures for the current run', async method => {
  const { actions, store } = setup(vi.fn().mockRejectedValue(new Error('fixture failure')));
  store.setState({ isCrawlPaused: method === 'resumeSiteCrawl' });
  await actions[method]();
  expect(store.getState().crawlError).toBe('fixture failure');
});

it.each(methods.flatMap(method => [false, true].map(failure => ({ method, failure }))))(
  'ignores late $method completion (failure=$failure)', async ({ method, failure }) => {
    let complete!: (value: unknown) => void;
    let reject!: (value: unknown) => void;
    const { actions, store } = setup(vi.fn(() => new Promise((resolve, fail) => { complete = resolve; reject = fail; })));
    store.setState({ isCrawlPaused: method === 'resumeSiteCrawl' });
    const pending = actions[method]();
    useProjectStore.setState({ activeProjectId: 'other' });
    store.setState({ activeCrawlRunId: null, crawlError: null, isCrawlPaused: false });
    if (failure) reject(new Error('old failure')); else complete(undefined);
    await pending;
    expect(store.getState()).toMatchObject({ activeCrawlRunId: null, crawlError: null, isCrawlPaused: false });
  },
);

it('resumes a checkpoint against its own base run and discards its project checkpoint', async () => {
  const { actions, store } = setup();
  const base = createCrawlRunFixture();
  const startSiteCrawl = vi.fn().mockResolvedValue(base.result);
  store.setState({ isCrawling: false, crawlRuns: [base], startSiteCrawl, interruptedCrawl: {
    url: base.startUrl, limit: 5, config: DEFAULT_CRAWL_CONFIG, environment: 'staging',
    startedAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z', baseRunId: base.id,
    completedUrls: ['https://example.test/'],
  } });
  expect(await actions.resumeInterruptedCrawl()).toEqual(base.result);
  expect(startSiteCrawl).toHaveBeenCalledWith(base.startUrl, 5, expect.objectContaining({
    resumeCompletedUrls: ['https://example.test/'], resumeFrontierUrls: [],
  }), 'staging', true, base.result);
  actions.discardInterruptedCrawl();
  expect(store.getState().interruptedCrawl).toBeNull();
});

it('returns null when there is no interruption or a crawl is still active', async () => {
  const { actions, store } = setup();
  expect(await actions.resumeInterruptedCrawl()).toBeNull();
  store.setState({ interruptedCrawl: { url: 'https://example.test/', limit: 5, config: DEFAULT_CRAWL_CONFIG,
    environment: 'default', startedAt: '', updatedAt: '' } });
  expect(await actions.resumeInterruptedCrawl()).toBeNull();
});

it('resumes without a missing base and avoids fabricating completed URLs, then discards without a project', async () => {
  const { actions, store } = setup();
  const startSiteCrawl = vi.fn().mockResolvedValue(null);
  store.setState({ isCrawling: false, startSiteCrawl, interruptedCrawl: {
    url: 'https://example.test/', limit: 5, config: DEFAULT_CRAWL_CONFIG,
    environment: 'default', startedAt: '', updatedAt: '',
  } });
  await actions.resumeInterruptedCrawl();
  expect(startSiteCrawl).toHaveBeenCalledWith('https://example.test/', 5, DEFAULT_CRAWL_CONFIG, 'default', true, undefined);
  useProjectStore.setState({ activeProjectId: null });
  actions.discardInterruptedCrawl();
  expect(store.getState().interruptedCrawl).toBeNull();
});
