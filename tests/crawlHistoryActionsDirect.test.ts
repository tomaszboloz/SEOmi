import { beforeEach, expect, it, vi } from 'vitest';
import { createCrawlHistoryActions } from '@/stores/tools/crawl/history';
import { useProjectStore } from '@/stores/projectStore';
import { isolatedToolsSlice } from './fixtures/toolsSlice';
import { createCrawlResultFixture, createCrawlRunFixture } from './fixtures/crawl';
beforeEach(() => { localStorage.clear(); useProjectStore.setState({ activeProjectId: 'history-direct' }); });

it('rejects incomplete scheduled snapshots before writing them into history', async () => {
  const saveCrawlRuns = vi.fn().mockResolvedValue({ prunedRuns: 0 });
  const { actions, store } = isolatedToolsSlice((set, get, services) => createCrawlHistoryActions(set, get, services),
    { saveCrawlRuns });
  const imported = await actions.importScheduledCrawlResult({ start_url: 'https://example.test/', pages: [] });
  expect(imported).toBe(false);
  expect(saveCrawlRuns).not.toHaveBeenCalled();
  expect(store.getState().crawlResult).toBeNull();
});

it('retains older same-URL runs and deduplicates only a stable scheduled execution identity', async () => {
  const saveCrawlRuns = vi.fn().mockResolvedValue({ prunedRuns: 0 });
  const { actions, store } = isolatedToolsSlice((set, get, services) => createCrawlHistoryActions(set, get, services),
    { saveCrawlRuns });
  store.setState({ crawlRuns: [createCrawlRunFixture()] });
  const result = createCrawlResultFixture();
  expect(await actions.importScheduledCrawlResult(result, 'schedule/1')).toBe(true);
  expect(await actions.importScheduledCrawlResult(result, 'schedule/1')).toBe(true);
  expect(store.getState().crawlRuns.map(run => run.id)).toEqual(['scheduled-crawl-schedule-1', 'fixture-run']);
  expect(store.getState().crawlResult).toEqual(result);
});

it('retries complete history and exposes successful compaction or pruning', async () => {
  const saveCrawlRuns = vi.fn().mockResolvedValue({ prunedRuns: 1, compactedRuns: 1 });
  const { actions, store } = isolatedToolsSlice((set, get, services) => createCrawlHistoryActions(set, get, services),
    { saveCrawlRuns });
  store.setState({ crawlRuns: [createCrawlRunFixture(), createCrawlRunFixture({ id: 'older' })] });
  await actions.retryCrawlPersistence();
  expect(saveCrawlRuns).toHaveBeenCalledWith('history-direct', expect.arrayContaining([expect.objectContaining({ id: 'older' })]));
  expect(store.getState().crawlRuns).toHaveLength(1);
  expect(store.getState()).toMatchObject({ crawlPersistenceError: null, crawlPersistenceCompacted: true,
    isRetryingCrawlPersistence: false });
  expect(store.getState().crawlPersistenceNotice).toBeTruthy();
});

it.each([null, 'history-direct'])('rejects unavailable retry history with project %s', async projectId => {
  useProjectStore.setState({ activeProjectId: projectId });
  const saveCrawlRuns = vi.fn();
  const { actions, store } = isolatedToolsSlice((set, get, services) => createCrawlHistoryActions(set, get, services),
    { saveCrawlRuns });
  await actions.retryCrawlPersistence();
  expect(saveCrawlRuns).not.toHaveBeenCalled();
  expect(store.getState().crawlPersistenceError).toBeTruthy();
});
