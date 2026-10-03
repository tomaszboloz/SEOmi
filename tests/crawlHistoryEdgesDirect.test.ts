import { beforeEach, expect, it, vi } from 'vitest';
import { createCrawlHistoryActions } from '@/stores/tools/crawl/history';
import { useProjectStore } from '@/stores/projectStore';
import { isolatedToolsSlice } from './fixtures/toolsSlice';
import { createCrawlResultFixture, createCrawlRunFixture } from './fixtures/crawl';
const methods = ['importScheduledCrawlResult', 'retryCrawlPersistence'] as const;
beforeEach(() => { localStorage.clear(); useProjectStore.setState({ activeProjectId: 'history-edges' }); });
const setup = (saveCrawlRuns = vi.fn().mockResolvedValue({ prunedRuns: 0 })) => {
  const slice = isolatedToolsSlice((set, get, services) => createCrawlHistoryActions(set, get, services), { saveCrawlRuns });
  slice.store.setState({ crawlRuns: [createCrawlRunFixture()] });
  return slice;
};

it('rejects a valid scheduled snapshot without a selected project', async () => {
  useProjectStore.setState({ activeProjectId: null });
  const saveCrawlRuns = vi.fn();
  const { actions } = setup(saveCrawlRuns);
  expect(await actions.importScheduledCrawlResult(createCrawlResultFixture())).toBe(false);
  expect(saveCrawlRuns).not.toHaveBeenCalled();
});

it('creates an independent identity when no scheduled execution identity exists', async () => {
  const { actions, store } = setup();
  expect(await actions.importScheduledCrawlResult(createCrawlResultFixture())).toBe(true);
  expect(store.getState().crawlRuns).toHaveLength(2);
  expect(store.getState().crawlRuns[0].id).not.toBe('fixture-run');
});

it.each(methods.flatMap(method => [new Error('failure'), new DOMException('quota', 'QuotaExceededError'), 'unstructured']
  .map(error => ({ method, error }))))('contains $method persistence error $error', async ({ method, error }) => {
    const { actions, store } = setup(vi.fn().mockRejectedValue(error));
    if (method === 'importScheduledCrawlResult') expect(await actions[method](createCrawlResultFixture())).toBe(false);
    else await actions[method]();
    expect(store.getState().crawlPersistenceError).toBeTruthy();
    expect(store.getState().isRetryingCrawlPersistence).toBe(false);
  },
);

it.each(methods.flatMap(method => [false, true].map(failure => ({ method, failure }))))(
  'ignores late $method save completion (failure=$failure)', async ({ method, failure }) => {
    let complete!: (value: unknown) => void;
    let reject!: (value: unknown) => void;
    const { actions, store } = setup(vi.fn(() => new Promise((resolve, fail) => { complete = resolve; reject = fail; })));
    const pending = method === 'importScheduledCrawlResult' ? actions[method](createCrawlResultFixture()) : actions[method]();
    useProjectStore.setState({ activeProjectId: 'other' });
    store.setState({ crawlRuns: [], crawlResult: null, crawlPersistenceError: null, isRetryingCrawlPersistence: false });
    if (failure) reject(new Error('old failure')); else complete({ prunedRuns: 0 });
    await pending;
    expect(store.getState()).toMatchObject({ crawlRuns: [], crawlResult: null, crawlPersistenceError: null,
      isRetryingCrawlPersistence: false });
  },
);

it.each([false, true])('retains compaction evidence from the stored snapshot (compacted=%s)', async compacted => {
  const { actions, store } = setup();
  store.setState({ crawlRuns: [createCrawlRunFixture({ storage_compacted: compacted })] });
  await actions.retryCrawlPersistence();
  expect(store.getState().crawlPersistenceCompacted).toBe(compacted);
  expect(store.getState().crawlPersistenceNotice).toBeTruthy();
});
