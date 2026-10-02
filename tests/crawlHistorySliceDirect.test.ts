import { beforeEach, expect, it, vi } from 'vitest';
import { createCrawlHistorySlice } from '@/stores/tools/crawlHistorySlice';
import { useProjectStore } from '@/stores/projectStore';
import { isolatedToolsSlice } from './fixtures/toolsSlice';
import { createCrawlRunFixture } from './fixtures/crawl';
const first = createCrawlRunFixture({ id: 'first' });
const second = createCrawlRunFixture({ id: 'second' });
beforeEach(() => { localStorage.clear(); useProjectStore.setState({ activeProjectId: 'saved-history' }); });
const setup = (saveCrawlRuns = vi.fn().mockResolvedValue({ prunedRuns: 0 })) => {
  const slice = isolatedToolsSlice((set, get, services) => createCrawlHistorySlice(set, get, services), { saveCrawlRuns });
  slice.store.setState({ crawlRuns: [first, second], crawlResult: first.result, selectedCrawlRunId: first.id });
  return { ...slice, saveCrawlRuns };
};

it('selects a real run and clears its previous runtime errors', () => {
  const { actions, store } = setup();
  store.setState({ crawlError: 'previous', crawlExternalLinkCheckError: 'previous' });
  actions.selectCrawlRun(second.id);
  expect(store.getState()).toMatchObject({ crawlResult: second.result, selectedCrawlRunId: second.id,
    crawlError: null, crawlExternalLinkCheckError: null });
  actions.selectCrawlRun('missing');
  expect(store.getState().selectedCrawlRunId).toBe(second.id);
});

it.each([first.id, second.id])('deletes %s and preserves the appropriate selected result', async id => {
  const { actions, store, saveCrawlRuns } = setup();
  await actions.deleteCrawlRun(id);
  const retained = id === first.id ? second : first;
  expect(saveCrawlRuns).toHaveBeenCalledWith('saved-history', [retained]);
  expect(store.getState()).toMatchObject({ crawlRuns: [retained], selectedCrawlRunId: retained.id,
    crawlResult: retained.result, crawlPersistenceError: null, crawlPersistenceCompacted: false });
});

it('clears the selected result after deleting the last run', async () => {
  const { actions, store } = setup();
  store.setState({ crawlRuns: [first] });
  await actions.deleteCrawlRun(first.id);
  expect(store.getState()).toMatchObject({ crawlRuns: [], crawlResult: null, selectedCrawlRunId: null });
});

it.each([new Error('native failure'), 'unstructured failure'])('restores the optimistic snapshot after rejection %s', async error => {
  const { actions, store } = setup(vi.fn().mockRejectedValue(error));
  await actions.deleteCrawlRun(first.id);
  expect(store.getState()).toMatchObject({ crawlRuns: [first, second], crawlResult: first.result, selectedCrawlRunId: first.id });
  expect(store.getState().crawlPersistenceError).toBeTruthy();
});

it('rejects active-crawl deletion, missing run and absent project before persistence', async () => {
  const { actions, store, saveCrawlRuns } = setup();
  store.setState({ isCrawling: true });
  await actions.deleteCrawlRun(first.id);
  expect(store.getState().crawlPersistenceError).toBeTruthy();
  store.setState({ isCrawling: false });
  await actions.deleteCrawlRun('missing');
  expect(store.getState().crawlPersistenceError).toBeTruthy();
  useProjectStore.setState({ activeProjectId: null });
  await actions.deleteCrawlRun(first.id);
  expect(saveCrawlRuns).not.toHaveBeenCalled();
});

it.each([first.result, null])('recovers implicit selection without a selected identifier', async current => {
  const { actions, store } = setup();
  store.setState({ selectedCrawlRunId: null, crawlResult: current });
  await actions.deleteCrawlRun(first.id);
  expect(store.getState()).toMatchObject({ crawlRuns: [second], selectedCrawlRunId: second.id, crawlResult: second.result });
});

it('contains quota errors while restoring the previous selection', async () => {
  const { actions, store } = setup(vi.fn().mockRejectedValue(new DOMException('quota', 'QuotaExceededError')));
  await actions.deleteCrawlRun(first.id);
  expect(store.getState()).toMatchObject({ crawlRuns: [first, second], selectedCrawlRunId: first.id });
  expect(store.getState().crawlPersistenceError).toBeTruthy();
});

it.each([false, true])('ignores a late deletion completion after project change (failure=%s)', async failure => {
  let complete!: (value: unknown) => void;
  let reject!: (value: unknown) => void;
  const { actions, store } = setup(vi.fn(() => new Promise((resolve, fail) => { complete = resolve; reject = fail; })));
  const pending = actions.deleteCrawlRun(first.id);
  useProjectStore.setState({ activeProjectId: 'other' });
  store.setState({ crawlRuns: [], crawlResult: null, selectedCrawlRunId: null, crawlPersistenceError: null });
  if (failure) reject(new Error('old failure')); else complete({ prunedRuns: 0 });
  await pending;
  expect(store.getState()).toMatchObject({ crawlRuns: [], crawlResult: null, selectedCrawlRunId: null, crawlPersistenceError: null });
});
