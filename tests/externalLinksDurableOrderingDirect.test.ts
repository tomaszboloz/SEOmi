import { afterEach, expect, it, vi } from 'vitest';
import { createExternalLinksSlice } from '@/stores/tools/externalLinksSlice';
import { createCrawlHistorySlice } from '@/stores/tools/crawlHistorySlice';
import { saveCrawlRuns } from '@/services/crawlPersistence';
import { useProjectStore } from '@/stores/projectStore';
import type { CrawlRunRecord } from '@/types';
import { isolatedToolsSlice } from './fixtures/toolsSlice';
import { externalRun, checkedBatch } from './fixtures/externalLinksSlice';

const native = vi.hoisted(() => ({ invoke: vi.fn(), listen: vi.fn().mockResolvedValue(() => {}) }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: native.invoke }));
vi.mock('@tauri-apps/api/event', () => ({ listen: native.listen }));
afterEach(() => {
  delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  native.invoke.mockReset();
});

it('keeps deletion durable after a delayed external-check write using the production project write queue', async () => {
  localStorage.clear(); useProjectStore.setState({ activeProjectId: 'external-durable' });
  Object.defineProperty(window, '__TAURI_INTERNALS__', { value: {}, configurable: true });
  let release!: () => void;
  let durable: CrawlRunRecord[] = [];
  native.invoke.mockImplementation(async (_command, args: { crawlRuns: CrawlRunRecord[] }) => {
    if (args.crawlRuns.length) await new Promise<void>(resolve => { release = resolve; });
    durable = args.crawlRuns;
  });
  const { store, actions } = isolatedToolsSlice((set, get, services) => ({
    ...createExternalLinksSlice(set, get, services), ...createCrawlHistorySlice(set, get, services),
  }), { invoke: vi.fn().mockResolvedValue(checkedBatch), saveCrawlRuns });
  const run = externalRun();
  store.setState({ crawlRuns: [run], crawlResult: run.result, selectedCrawlRunId: run.id });
  const checking = actions.checkCrawlExternalLinks(run.id, 10);
  await vi.waitFor(() => expect(native.invoke).toHaveBeenCalledOnce());
  const deleting = actions.deleteCrawlRun(run.id);
  expect(store.getState().crawlRuns).toEqual([]);
  expect(native.invoke).toHaveBeenCalledOnce();
  release();
  await Promise.all([checking, deleting]);
  expect(native.invoke).toHaveBeenCalledTimes(2);
  expect(durable).toEqual([]);
  expect(store.getState()).toMatchObject({ crawlRuns: [], crawlResult: null, selectedCrawlRunId: null });
});
