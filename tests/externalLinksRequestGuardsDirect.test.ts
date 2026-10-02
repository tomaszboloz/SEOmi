import { beforeEach, expect, it, vi } from 'vitest';
import { createExternalLinksSlice } from '@/stores/tools/externalLinksSlice';
import { useProjectStore } from '@/stores/projectStore';
import { isolatedToolsSlice } from './fixtures/toolsSlice';
import { externalRun, checkedBatch } from './fixtures/externalLinksSlice';
beforeEach(() => { localStorage.clear(); useProjectStore.setState({ activeProjectId: 'external-guards' }); });

it('does not publish an old request error into a newer same-project check', async () => {
  let reject!: (error: Error) => void;
  const invoke = vi.fn().mockImplementation(() => new Promise((_, fail) => { reject = fail; }));
  const { store, actions } = isolatedToolsSlice((set, get, services) => createExternalLinksSlice(set, get, services), { invoke });
  const origin = externalRun();
  store.setState({ crawlRuns: [origin] });
  const pending = actions.checkCrawlExternalLinks(origin.id, 10);
  store.setState({ crawlExternalLinkCheckProgress: { requestId: 'newer-request', completed: 0, total: 1, currentUrl: '' },
    crawlExternalLinkCheckError: null });
  reject(new Error('old failure'));
  await pending;
  expect(store.getState().crawlExternalLinkCheckError).toBeNull();
  expect(store.getState().crawlExternalLinkCheckProgress?.requestId).toBe('newer-request');
  expect(store.getState().isCheckingCrawlExternalLinks).toBe(true);
});

it.each([NaN, Infinity, -Infinity])('sends a finite bounded native limit for invalid numeric input %s', async value => {
  const invoke = vi.fn().mockResolvedValue(checkedBatch);
  const { store, actions } = isolatedToolsSlice((set, get, services) => createExternalLinksSlice(set, get, services),
    { invoke, saveCrawlRuns: vi.fn().mockResolvedValue({ prunedRuns: 0 }) });
  const origin = externalRun();
  store.setState({ crawlRuns: [origin] });
  await actions.checkCrawlExternalLinks(origin.id, value);
  expect(invoke).toHaveBeenCalledWith('check_external_crawl_links', expect.objectContaining({ maxUrls: 1 }));
});
