import { beforeEach, expect, it, vi } from 'vitest';
import { createCrawlSlice } from '@/stores/tools/crawlSlice';
import { useProjectStore } from '@/stores/projectStore';
import { isolatedToolsSlice } from './fixtures/toolsSlice';
import { createCrawlPageFixture, createCrawlResultFixture, createCrawlRunFixture } from './fixtures/crawl';

beforeEach(() => { localStorage.clear(); useProjectStore.setState({ activeProjectId: 'origin' }); });

it('keeps background crawl history attached to its origin when another project has its own history', async () => {
  let complete!: (value: unknown) => void;
  const invoke = vi.fn(() => new Promise(resolve => { complete = resolve; }));
  const saveCrawlRuns = vi.fn().mockResolvedValue({ prunedRuns: 0 });
  const { store, actions } = isolatedToolsSlice((set, get, services) => createCrawlSlice(set, get, services),
    { invoke: invoke as never, saveCrawlRuns, notifyCrawlCompleted: vi.fn() });
  const original = createCrawlRunFixture({ id: 'original-history' });
  store.setState({ crawlRuns: [original] });
  const pending = actions.startSiteCrawl('https://example.test/', 1);
  useProjectStore.setState({ activeProjectId: 'other' });
  const other = createCrawlRunFixture({ id: 'other-project-history' });
  store.setState({ crawlRuns: [other], activeCrawlRunId: null, isCrawling: false });
  complete(createCrawlResultFixture({ pages_crawled: 1, pages: [createCrawlPageFixture()] }));
  await pending;
  expect(saveCrawlRuns).toHaveBeenCalledTimes(1);
  expect(saveCrawlRuns.mock.calls[0][0]).toBe('origin');
  expect(saveCrawlRuns.mock.calls[0][1].map((run: { id: string }) => run.id)).toEqual([
    expect.any(String), 'original-history',
  ]);
  expect(store.getState().crawlRuns).toEqual([other]);
});

it('does not let a pending history save from an earlier run overwrite a newly completed run', async () => {
  let completeSave!: (value: unknown) => void;
  const saveCrawlRuns = vi.fn().mockImplementationOnce(() => new Promise(resolve => { completeSave = resolve; }))
    .mockResolvedValue({ prunedRuns: 0 });
  const invoke = vi.fn().mockResolvedValue(createCrawlResultFixture({ pages_crawled: 1, pages: [createCrawlPageFixture()] }));
  const { store, actions } = isolatedToolsSlice((set, get, services) => createCrawlSlice(set, get, services),
    { invoke: invoke as never, saveCrawlRuns, notifyCrawlCompleted: vi.fn() });
  const first = actions.startSiteCrawl('https://example.test/first', 1);
  await vi.waitFor(() => expect(saveCrawlRuns).toHaveBeenCalledTimes(1));
  await actions.startSiteCrawl('https://example.test/second', 1);
  const latest = store.getState().crawlRuns;
  completeSave({ prunedRuns: 0 });
  await first;
  expect(store.getState().crawlRuns).toEqual(latest);
  expect(store.getState().crawlRuns[0].startUrl).toBe('https://example.test/second');
});
