import { beforeEach, expect, it, vi } from 'vitest';
import { persistExternalLinkEvidence } from '@/stores/tools/externalLinks/persistence';
import { useProjectStore } from '@/stores/projectStore';
import { externalPersistenceFixture } from './fixtures/externalPersistence';
import { externalRun } from './fixtures/externalLinksSlice';
import { checkedBatch } from './fixtures/externalLinksSlice';
import { createExternalLinksSlice } from '@/stores/tools/externalLinksSlice';
import { isolatedToolsSlice } from './fixtures/toolsSlice';
import { beginToolRequest } from '@/stores/tools/runtime';
beforeEach(() => { localStorage.clear(); useProjectStore.setState({ activeProjectId: 'external-persistence' }); });

it('does not save a superseded background response after navigation returns to its project', async () => {
  let finish!: (value: ReturnType<typeof externalRun>[]) => void;
  const loadCrawlRuns = vi.fn(() => new Promise<ReturnType<typeof externalRun>[]>(resolve => { finish = resolve; }));
  const { store, services, context } = externalPersistenceFixture({ loadCrawlRuns });
  useProjectStore.setState({ activeProjectId: 'other-project' });
  const pending = persistExternalLinkEvidence(context);
  expect(loadCrawlRuns).toHaveBeenCalledOnce();
  useProjectStore.setState({ activeProjectId: 'external-persistence' });
  store.setState({ crawlExternalLinkCheckProgress: { requestId: 'newer-request', completed: 0, total: 1, currentUrl: '' } });
  finish([externalRun()]);
  await pending;
  expect(services.saveCrawlRuns).not.toHaveBeenCalled();
  expect(store.getState().crawlRuns[0].result.pages[0].links[0].target_http_status).toBeUndefined();
});

it('does not apply a saved snapshot after its originating project has been left', async () => {
  let finish!: (value: { prunedRuns: number }) => void;
  const saveCrawlRuns = vi.fn(() => new Promise<{ prunedRuns: number }>(resolve => { finish = resolve; }));
  const { store, context } = externalPersistenceFixture({ saveCrawlRuns });
  const pending = persistExternalLinkEvidence(context);
  useProjectStore.setState({ activeProjectId: 'other-project' });
  const other = externalRun('other-run');
  store.setState({ crawlRuns: [other], crawlResult: other.result, selectedCrawlRunId: other.id,
    crawlPersistenceError: 'newer error' });
  finish({ prunedRuns: 0 });
  await pending;
  expect(store.getState()).toMatchObject({ crawlRuns: [other], crawlResult: other.result,
    selectedCrawlRunId: other.id, crawlPersistenceError: 'newer error' });
});

it('does not let an older background check overwrite a newer durable check while another project is selected', async () => {
  const origin = externalRun();
  let durable = [origin];
  let oldResponse!: (value: unknown) => void;
  let newResponse!: (value: unknown) => void;
  const invoke = vi.fn().mockImplementationOnce(() => new Promise(resolve => { oldResponse = resolve; }))
    .mockImplementationOnce(() => new Promise(resolve => { newResponse = resolve; }));
  const saveCrawlRuns = vi.fn().mockImplementation(async (_projectId, rows) => {
    durable = rows;
    return { prunedRuns: 0 };
  });
  const { store, actions } = isolatedToolsSlice((set, get, services) => createExternalLinksSlice(set, get, services),
    { invoke, saveCrawlRuns, loadCrawlRuns: vi.fn().mockImplementation(async () => durable) });
  store.setState({ crawlRuns: [origin] });
  const older = actions.checkCrawlExternalLinks(origin.id, 10);
  store.setState({ isCheckingCrawlExternalLinks: false, crawlExternalLinkCheckProgress: null });
  const newer = actions.checkCrawlExternalLinks(origin.id, 10);
  useProjectStore.setState({ activeProjectId: 'other-project' });
  const healthy = { ...checkedBatch, results: [{ ...checkedBatch.results[0], httpStatus: 200 }] };
  newResponse(healthy);
  await newer;
  oldResponse(checkedBatch);
  await older;
  expect(saveCrawlRuns).toHaveBeenCalledOnce();
  expect(durable[0].result.pages[0].links[0].target_http_status).toBe(200);
});

it('uses the current history if navigation returns to the origin during its durable load', async () => {
  let finish!: (value: ReturnType<typeof externalRun>[]) => void;
  const { store, services, context } = externalPersistenceFixture({
    loadCrawlRuns: vi.fn(() => new Promise<ReturnType<typeof externalRun>[]>(resolve => { finish = resolve; })),
  });
  useProjectStore.setState({ activeProjectId: 'other-project' });
  const pending = persistExternalLinkEvidence(context);
  useProjectStore.setState({ activeProjectId: 'external-persistence' });
  const newer = externalRun('newer-run');
  store.setState({ crawlRuns: [newer, externalRun()] });
  finish([externalRun()]);
  await pending;
  expect(services.saveCrawlRuns).toHaveBeenCalledWith('external-persistence',
    expect.arrayContaining([expect.objectContaining({ id: newer.id })]));
  expect(store.getState().crawlRuns.map(run => run.id)).toEqual([newer.id, context.runId]);
});

it('rechecks the request generation after a background durable load', async () => {
  let finish!: (value: ReturnType<typeof externalRun>[]) => void;
  const { services, context } = externalPersistenceFixture({
    loadCrawlRuns: vi.fn(() => new Promise<ReturnType<typeof externalRun>[]>(resolve => { finish = resolve; })),
  });
  useProjectStore.setState({ activeProjectId: 'other-project' });
  const pending = persistExternalLinkEvidence(context);
  beginToolRequest('external-links:external-persistence');
  finish([externalRun()]);
  await pending;
  expect(services.saveCrawlRuns).not.toHaveBeenCalled();
});

it('does not publish stale save metadata even if old progress survived a newer generation', async () => {
  let finish!: (value: { prunedRuns: number }) => void;
  const { store, context } = externalPersistenceFixture({
    saveCrawlRuns: vi.fn(() => new Promise<{ prunedRuns: number }>(resolve => { finish = resolve; })),
  });
  const pending = persistExternalLinkEvidence(context);
  beginToolRequest('external-links:external-persistence');
  store.setState({ crawlPersistenceError: 'newer-error' });
  finish({ prunedRuns: 0 });
  await pending;
  expect(store.getState().crawlPersistenceError).toBe('newer-error');
});
