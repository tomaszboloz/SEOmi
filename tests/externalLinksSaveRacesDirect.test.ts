import { beforeEach, expect, it, vi } from 'vitest';
import { createExternalLinksSlice } from '@/stores/tools/externalLinksSlice';
import { useProjectStore } from '@/stores/projectStore';
import { isolatedToolsSlice } from './fixtures/toolsSlice';
import { externalRun, checkedBatch } from './fixtures/externalLinksSlice';
beforeEach(() => { localStorage.clear(); useProjectStore.setState({ activeProjectId: 'external-races' }); });

it('keeps the currently selected result when selection changes during a history save', async () => {
  let finish!: (value: { prunedRuns: number }) => void;
  const saveCrawlRuns = vi.fn(() => new Promise<{ prunedRuns: number }>(resolve => { finish = resolve; }));
  const { store, actions } = isolatedToolsSlice((set, get, services) => createExternalLinksSlice(set, get, services),
    { invoke: vi.fn().mockResolvedValue(checkedBatch), saveCrawlRuns });
  const origin = externalRun();
  const other = externalRun('other-run');
  store.setState({ crawlRuns: [origin, other], selectedCrawlRunId: origin.id, crawlResult: origin.result });
  const pending = actions.checkCrawlExternalLinks(origin.id, 10);
  await vi.waitFor(() => expect(saveCrawlRuns).toHaveBeenCalledOnce());
  store.setState({ selectedCrawlRunId: other.id, crawlResult: other.result });
  finish({ prunedRuns: 0 });
  await pending;
  expect(store.getState().selectedCrawlRunId).toBe(other.id);
  expect(store.getState().crawlResult).toBe(other.result);
  expect(store.getState().crawlRuns[0].result.pages[0].links[0].target_http_status).toBe(404);
});

it('does not restore a run deleted while its updated history is being saved', async () => {
  let finish!: (value: { prunedRuns: number }) => void;
  const saveCrawlRuns = vi.fn(() => new Promise<{ prunedRuns: number }>(resolve => { finish = resolve; }));
  const { store, actions } = isolatedToolsSlice((set, get, services) => createExternalLinksSlice(set, get, services),
    { invoke: vi.fn().mockResolvedValue(checkedBatch), saveCrawlRuns });
  const origin = externalRun();
  store.setState({ crawlRuns: [origin], selectedCrawlRunId: origin.id, crawlResult: origin.result });
  const pending = actions.checkCrawlExternalLinks(origin.id, 10);
  await vi.waitFor(() => expect(saveCrawlRuns).toHaveBeenCalledOnce());
  store.setState({ crawlRuns: [], selectedCrawlRunId: null, crawlResult: null });
  finish({ prunedRuns: 0 });
  await pending;
  expect(store.getState()).toMatchObject({ crawlRuns: [], selectedCrawlRunId: null, crawlResult: null });
});

it('does not replace newer history appended during an external-check save', async () => {
  let finish!: (value: { prunedRuns: number }) => void;
  const saveCrawlRuns = vi.fn(() => new Promise<{ prunedRuns: number }>(resolve => { finish = resolve; }));
  const { store, actions } = isolatedToolsSlice((set, get, services) => createExternalLinksSlice(set, get, services),
    { invoke: vi.fn().mockResolvedValue(checkedBatch), saveCrawlRuns });
  const origin = externalRun();
  store.setState({ crawlRuns: [origin], selectedCrawlRunId: origin.id, crawlResult: origin.result });
  const pending = actions.checkCrawlExternalLinks(origin.id, 10);
  await vi.waitFor(() => expect(saveCrawlRuns).toHaveBeenCalledOnce());
  const newer = externalRun('newer-run');
  store.setState({ crawlRuns: [newer, ...store.getState().crawlRuns], selectedCrawlRunId: newer.id, crawlResult: newer.result });
  finish({ prunedRuns: 0 });
  await pending;
  expect(store.getState().crawlRuns.map(row => row.id)).toEqual([newer.id, origin.id]);
  expect(store.getState().crawlResult).toBe(newer.result);
});
