import { vi } from 'vitest';
import type { ToolsServices } from '@/stores/tools/contracts';
import { beginToolRequest } from '@/stores/tools/runtime';
import { isolatedToolsSlice } from './toolsSlice';
import { externalRun, checkedBatch } from './externalLinksSlice';

export function externalPersistenceFixture(overrides: Partial<ToolsServices> = {}) {
  const { store, services } = isolatedToolsSlice(() => ({}), {
    saveCrawlRuns: vi.fn().mockResolvedValue({ prunedRuns: 0 }), ...overrides,
  });
  const run = externalRun();
  const requestId = beginToolRequest('external-links:external-persistence');
  store.setState({ crawlRuns: [run], selectedCrawlRunId: run.id, crawlResult: run.result,
    crawlExternalLinkCheckProgress: { requestId, completed: 0, total: 1, currentUrl: '' } });
  const context = { projectId: 'external-persistence', runId: run.id, requestId,
    batch: checkedBatch, force: false, set: store.setState, get: store.getState, services };
  return { store, services, context, run };
}
