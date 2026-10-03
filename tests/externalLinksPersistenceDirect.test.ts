import { beforeEach, expect, it, vi } from 'vitest';
import { persistExternalLinkEvidence } from '@/stores/tools/externalLinks/persistence';
import { useProjectStore } from '@/stores/projectStore';
import i18n from '@/i18n';
import { externalPersistenceFixture } from './fixtures/externalPersistence';
import { externalRun } from './fixtures/externalLinksSlice';
beforeEach(() => { localStorage.clear(); useProjectStore.setState({ activeProjectId: 'external-persistence' }); });

it('saves checked origin evidence and applies factual result metadata', async () => {
  const { store, services, context } = externalPersistenceFixture();
  await persistExternalLinkEvidence(context);
  expect(services.saveCrawlRuns).toHaveBeenCalledWith('external-persistence', expect.any(Array));
  expect(store.getState().crawlResult?.pages[0].links[0].target_http_status).toBe(404);
  expect(store.getState()).toMatchObject({ crawlPersistenceError: null, crawlPersistenceNotice: null });
});

it('persists a background check only to its originating project', async () => {
  const loadCrawlRuns = vi.fn().mockResolvedValue([externalRun()]);
  const { store, services, context } = externalPersistenceFixture({ loadCrawlRuns });
  useProjectStore.setState({ activeProjectId: 'other-project' });
  store.setState({ crawlRuns: [], selectedCrawlRunId: null, crawlResult: null, crawlPersistenceError: 'newer' });
  await persistExternalLinkEvidence(context);
  expect(loadCrawlRuns).toHaveBeenCalledWith('external-persistence');
  expect(services.saveCrawlRuns).toHaveBeenCalledWith('external-persistence', expect.any(Array));
  expect(store.getState()).toMatchObject({ crawlRuns: [], crawlResult: null, crawlPersistenceError: 'newer' });
});

it('does not persist evidence from a superseded same-project request', async () => {
  const { store, services, context } = externalPersistenceFixture();
  store.setState({ crawlExternalLinkCheckProgress: null });
  await persistExternalLinkEvidence(context);
  expect(services.saveCrawlRuns).not.toHaveBeenCalled();
});

it.each([false, true])('does not restore a missing originating run (background=%s)', async background => {
  const { store, services, context } = externalPersistenceFixture({ loadCrawlRuns: vi.fn().mockResolvedValue([]) });
  store.setState({ crawlRuns: [] });
  if (background) useProjectStore.setState({ activeProjectId: 'other-project' });
  await persistExternalLinkEvidence(context);
  expect(services.saveCrawlRuns).not.toHaveBeenCalled();
  expect(store.getState().crawlRuns).toEqual([]);
  expect(store.getState().crawlExternalLinkCheckError)
    .toBe(background ? null : i18n.t('runtimeErrors.tools.runUnavailable'));
});

it.each([false, true])('reports compacted storage whether flagged by the writer or retained run (writer=%s)', async writer => {
  const { store, context } = externalPersistenceFixture({
    saveCrawlRuns: vi.fn().mockResolvedValue({ prunedRuns: 0, ...(writer ? { compactedRuns: 1 } : {}) }),
  });
  if (!writer) store.setState({ crawlRuns: [{ ...externalRun(), storage_compacted: true }] });
  await persistExternalLinkEvidence(context);
  expect(store.getState().crawlPersistenceCompacted).toBe(true);
  expect(store.getState().crawlPersistenceNotice)
    .toBe(i18n.t(writer ? 'runtimeErrors.tools.quotaCompacted' : 'runtimeErrors.tools.boundedResave'));
});

it('reports pruned history and omitted checks without inventing checked targets', async () => {
  const { store, context } = externalPersistenceFixture({ saveCrawlRuns: vi.fn().mockResolvedValue({ prunedRuns: 1 }) });
  store.setState({ crawlRuns: [externalRun(), externalRun('older')] });
  await persistExternalLinkEvidence({ ...context, batch: { ...context.batch, omitted: 1, requested: 2 } });
  expect(store.getState().crawlRuns).toHaveLength(1);
  expect(store.getState().crawlPersistenceNotice).toBeTruthy();
  expect(store.getState().crawlExternalLinkCheckError)
    .toBe(i18n.t('runtimeErrors.tools.externalCheckSummary', { checked: 1, requested: 2, omitted: 1 }));
});

it.each([new Error('disk write failed'), 'unstructured failure', new DOMException('full', 'QuotaExceededError')])(
  'keeps live checked evidence and exposes storage failure %s', async error => {
  const { store, context } = externalPersistenceFixture({ saveCrawlRuns: vi.fn().mockRejectedValue(error) });
  await persistExternalLinkEvidence(context);
  expect(store.getState().crawlResult?.pages[0].links[0].target_http_status).toBe(404);
  expect(store.getState().crawlPersistenceError).toBeTruthy();
});
