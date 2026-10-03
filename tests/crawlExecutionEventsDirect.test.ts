import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createCrawlHistoryActions } from '@/stores/tools/crawl/history';
import { createCrawlHistorySlice } from '@/stores/tools/crawlHistorySlice';
import { createCrawlRunFixture } from './fixtures/crawl';
import { createCrawlExecutionActions } from '@/stores/tools/crawl/execution';
import { useProjectStore } from '@/stores/projectStore';
import { isolatedToolsSlice } from './fixtures/toolsSlice';
import { createCrawlPageFixture, createCrawlResultFixture } from './fixtures/crawl';
import type { CrawlProgress } from '@/types';
const events = vi.hoisted(() => ({ listen: vi.fn(), unlisten: vi.fn() }));
vi.mock('@tauri-apps/api/event', () => ({ listen: events.listen }));
vi.mock('@/services/tauri', () => ({ invokeTauriCommand: vi.fn().mockResolvedValue(undefined),
  getSecureValue: vi.fn().mockResolvedValue(''), isTauriEnvironment: () => '__TAURI_INTERNALS__' in window }));
beforeEach(() => {
  localStorage.clear(); useProjectStore.setState({ activeProjectId: 'event-direct' });
  events.listen.mockReset(); events.unlisten.mockReset();
  Object.defineProperty(window, '__TAURI_INTERNALS__', { configurable: true, value: {} });
});
afterEach(() => { delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__; });

it('accepts only telemetry for the active originating run and releases its native event listener', async () => {
  let emit!: (event: { payload: CrawlProgress }) => void;
  events.listen.mockImplementation(async (_name, handler) => { emit = handler; return events.unlisten; });
  let complete!: (value: unknown) => void;
  const invoke = vi.fn(() => new Promise(resolve => { complete = resolve; }));
  const { actions, store } = isolatedToolsSlice((set, get, services) => createCrawlExecutionActions(set, get, services),
    { invoke: invoke as never, saveCrawlRuns: vi.fn().mockResolvedValue({ prunedRuns: 0 }), notifyCrawlCompleted: vi.fn() });
  const pending = actions.startSiteCrawl('https://example.test/', 5);
  await vi.waitFor(() => expect(invoke).toHaveBeenCalled());
  const runId = store.getState().activeCrawlRunId!;
  const progress: CrawlProgress = { runId, discovered: 4, completed: 2, queued: 2, cancelled: false, paused: false,
    elapsedMs: 50, pagesPerSecond: 1 };
  emit({ payload: { ...progress, runId: 'other-run' } });
  expect(store.getState().crawlProgress).toBe(0);
  emit({ payload: progress });
  expect(store.getState().crawlProgress).toBe(50);
  emit({ payload: { ...progress, discovered: 0, completed: 0 } });
  expect(store.getState().crawlProgress).toBe(0);
  useProjectStore.setState({ activeProjectId: 'other' });
  emit({ payload: progress });
  expect(store.getState().crawlProgress).toBe(0);
  complete(createCrawlResultFixture({ pages: [createCrawlPageFixture()], pages_crawled: 1 }));
  await pending;
  expect(events.unlisten).toHaveBeenCalledTimes(1);
  expect(events.listen).toHaveBeenCalledWith('crawl-progress', expect.any(Function));
});

it('contains native event registration errors and leaves a resumable descriptor', async () => {
  events.listen.mockRejectedValue(new Error('listener unavailable'));
  const invoke = vi.fn();
  const { actions, store } = isolatedToolsSlice((set, get, services) => createCrawlExecutionActions(set, get, services), { invoke });
  expect(await actions.startSiteCrawl('https://example.test/')).toBeNull();
  expect(invoke).not.toHaveBeenCalled();
  expect(store.getState()).toMatchObject({ crawlError: 'listener unavailable', isCrawling: false,
    interruptedCrawl: { url: 'https://example.test/' } });
});

it('cleans obsolete native history mirrors after successful retry and saved-run deletion', async () => {
  const saveCrawlRuns = vi.fn().mockResolvedValue({ prunedRuns: 0 });
  const { actions, store } = isolatedToolsSlice((set, get, services) => createCrawlHistoryActions(set, get, services), { saveCrawlRuns });
  store.setState({ crawlRuns: [createCrawlRunFixture()] });
  const writeMirrors = () => {
    localStorage.setItem('seomi_project_event-direct_crawl_runs', 'obsolete');
    localStorage.setItem('seomi_project_event-direct_crawl_result', 'obsolete');
  };
  writeMirrors();
  await actions.retryCrawlPersistence();
  expect(localStorage.getItem('seomi_project_event-direct_crawl_runs')).toBeNull();
  expect(localStorage.getItem('seomi_project_event-direct_crawl_result')).toBeNull();
  const saved = isolatedToolsSlice((set, get, services) => createCrawlHistorySlice(set, get, services), { saveCrawlRuns });
  saved.store.setState({ crawlRuns: [createCrawlRunFixture()] });
  writeMirrors();
  await saved.actions.deleteCrawlRun('fixture-run');
  expect(localStorage.getItem('seomi_project_event-direct_crawl_runs')).toBeNull();
  expect(localStorage.getItem('seomi_project_event-direct_crawl_result')).toBeNull();
});
