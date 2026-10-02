import { beforeEach, expect, it, vi } from 'vitest';
import { createExternalLinksSlice } from '@/stores/tools/externalLinksSlice';
import { useProjectStore } from '@/stores/projectStore';
import { isolatedToolsSlice } from './fixtures/toolsSlice';
import { externalRun } from './fixtures/externalLinksSlice';
beforeEach(() => { localStorage.clear(); useProjectStore.setState({ activeProjectId: 'external-action' }); });

it.each(['project', 'run', 'busy', 'checked'] as const)('rejects unavailable %s before a native request', async condition => {
  const invoke = vi.fn();
  const { store, actions } = isolatedToolsSlice((set, get, services) => createExternalLinksSlice(set, get, services), { invoke });
  const run = externalRun();
  store.setState({ crawlRuns: [run] });
  if (condition === 'project') useProjectStore.setState({ activeProjectId: null });
  if (condition === 'run') store.setState({ crawlRuns: [] });
  if (condition === 'busy') store.setState({ isCheckingCrawlExternalLinks: true });
  if (condition === 'checked') run.result.pages[0].links[0].target_checked_at = 'previous';
  await actions.checkCrawlExternalLinks(run.id, 10);
  expect(invoke).not.toHaveBeenCalled();
  if (condition !== 'busy') expect(store.getState().crawlExternalLinkCheckError).toBeTruthy();
});

it.each([new Error('native failed'), new DOMException('quota', 'QuotaExceededError'), 'unstructured failure'])(
  'contains native failure %s and releases the current busy state', async error => {
    const { store, actions } = isolatedToolsSlice((set, get, services) => createExternalLinksSlice(set, get, services),
      { invoke: vi.fn().mockRejectedValue(error) });
    const run = externalRun();
    store.setState({ crawlRuns: [run] });
    await actions.checkCrawlExternalLinks(run.id, 10);
    expect(store.getState()).toMatchObject({ isCheckingCrawlExternalLinks: false, crawlExternalLinkCheckProgress: null });
    expect(store.getState().crawlExternalLinkCheckError).toBeTruthy();
    if (error instanceof DOMException) expect(store.getState().crawlPersistenceError).toBeTruthy();
  });
