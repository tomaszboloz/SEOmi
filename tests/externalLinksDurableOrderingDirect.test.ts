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
  const durable = new Map<string, Record<string, unknown>>();
  native.invoke.mockImplementation(async (command: string, args: { runs?: CrawlRunRecord[] }) => {
    if (command === 'load_project_crawl_runs') return [];
    if (command === "store_replace_crawl_runs" && args.runs!.length) {
      await new Promise<void>(resolve => { release = resolve; });
    }
    if (command === "store_replace_crawl_runs") {
      durable.clear();
      args.runs!.forEach(run => durable.set(run.id, { id: run.id }));
    }
  });
  const calls = (name: string) => native.invoke.mock.calls.filter(([command]) => command === name).length;
  const { store, actions } = isolatedToolsSlice((set, get, services) => ({
    ...createExternalLinksSlice(set, get, services), ...createCrawlHistorySlice(set, get, services),
  }), { invoke: vi.fn().mockResolvedValue(checkedBatch), saveCrawlRuns });
  const run = externalRun();
  store.setState({ crawlRuns: [run], crawlResult: run.result, selectedCrawlRunId: run.id });
  const checking = actions.checkCrawlExternalLinks(run.id, 10);
  await vi.waitFor(() => expect(calls("store_replace_crawl_runs")).toBe(1));
  const deleting = actions.deleteCrawlRun(run.id);
  expect(store.getState().crawlRuns).toEqual([]);
  expect(calls("store_replace_crawl_runs")).toBe(1);
  release();
  await Promise.all([checking, deleting]);
  expect(calls("store_replace_crawl_runs")).toBe(2);
  expect(durable.size).toBe(0);
  expect(store.getState()).toMatchObject({ crawlRuns: [], crawlResult: null, selectedCrawlRunId: null });
});
