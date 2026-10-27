import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCrawlExecutionActions } from '@/stores/tools/crawl/execution';
import { LiveCrawlEventHook } from '@/stores/tools/crawl/executionHook';
import { PersistentCrawlEventLog } from '@/services/snapshots';
import { useProjectStore } from '@/stores/projectStore';
import { useSettingsStore } from '@/stores/settingsStore';
import * as tauriModule from '@/services/tauri';
import { isolatedToolsSlice } from './fixtures/toolsSlice';
import { createCrawlPageFixture, createCrawlResultFixture } from './fixtures/crawl';

vi.mock('@/services/tauri', () => ({
  isTauriEnvironment: vi.fn(),
  invokeTauriCommand: vi.fn(),
}));

const P = 'proj-live-hook';
const U = 'https://site.test/';

describe('Issue #138 Live In-flight Event Streaming Hook in Crawl Execution', () => {
  const originalSettings = useSettingsStore.getState();
  const capturedWireBatches: Array<{ projectId: string; runId: string; events: unknown[] }> = [];

  beforeEach(() => {
    localStorage.clear();
    capturedWireBatches.length = 0;
    useProjectStore.setState({ activeProjectId: P });
    vi.mocked(tauriModule.isTauriEnvironment).mockReturnValue(true);
    vi.mocked(tauriModule.invokeTauriCommand).mockImplementation(async (cmd, args) => {
      if (cmd === 'store_append_crawl_events') {
        const payload = args as { projectId: string; runId: string; events: unknown[] };
        capturedWireBatches.push(payload);
        return payload.events.length;
      }
      return null;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    useSettingsStore.setState(originalSettings);
  });

  it('does not create duplicate frontend writer to SQLite during desktop crawl', async () => {
    const page = createCrawlPageFixture({ url: U, final_url: U, http_status: 200 });
    const result = createCrawlResultFixture({ start_url: U, pages_crawled: 1, pages: [page] });
    const invoke = vi.fn().mockResolvedValue(result);
    const saveCrawlRuns = vi.fn().mockResolvedValue({ prunedRuns: 0 });
    const { actions } = isolatedToolsSlice(
      (set, get, services) => createCrawlExecutionActions(set, get, services),
      { invoke, saveCrawlRuns },
    );

    const out = await actions.startSiteCrawl(U, 1);
    expect(out).toEqual(result);
    // Native collector is the sole authoritative writer; frontend emits no duplicate events
    expect(capturedWireBatches).toHaveLength(0);
  });

  it('surfaces runtime failure and sets error state when crawler fails', async () => {
    const invoke = vi.fn().mockRejectedValue(new Error('Network unreachable'));
    const { actions, store } = isolatedToolsSlice(
      (set, get, services) => createCrawlExecutionActions(set, get, services),
      { invoke },
    );

    const out = await actions.startSiteCrawl(U, 1);
    expect(out).toBeNull();
    expect(store.getState().crawlError).toContain('Network unreachable');
    expect(capturedWireBatches).toHaveLength(0);
  });

  it('LiveCrawlEventHook streams started, progress, page and completed when given an event log', async () => {
    const log = new PersistentCrawlEventLog(P, 'run-direct');
    const hook = new LiveCrawlEventHook(P, 'run-direct', log);
    hook.appendStarted(U);
    hook.appendProgress({ runId: 'run-direct', discovered: 2, completed: 1, queued: 1, cancelled: false, paused: false, elapsedMs: 50, pagesPerSecond: 20 });
    hook.appendPages([createCrawlPageFixture({ url: U })]);
    await hook.appendCompleted(1, '2026-10-24T12:00:00Z', U);

    expect(hook.eventLog?.allEvents()).toHaveLength(4);
    expect(hook.eventLog?.allEvents().map((e) => e.type)).toEqual(['crawl:started', 'crawl:progress', 'crawl:page', 'crawl:completed']);
    const flatEvents = capturedWireBatches.flatMap((b) => b.events) as Array<{ eventType: string }>;
    expect(flatEvents).toHaveLength(4);
  });

  it('LiveCrawlEventHook streams cancelled and error events when given an event log', async () => {
    const log1 = new PersistentCrawlEventLog(P, 'run-cancelled');
    const hook1 = new LiveCrawlEventHook(P, 'run-cancelled', log1);
    hook1.appendStarted(U);
    await hook1.appendCancelled(0, U);
    expect(log1.allEvents().map((e) => e.type)).toEqual(['crawl:started', 'crawl:cancelled']);

    const log2 = new PersistentCrawlEventLog(P, 'run-error');
    const hook2 = new LiveCrawlEventHook(P, 'run-error', log2);
    hook2.appendStarted(U);
    await hook2.appendError('Network unreachable');
    expect(log2.allEvents().map((e) => e.type)).toEqual(['crawl:started', 'crawl:error']);
  });

  it('bounds events to originating project and run in PersistentCrawlEventLog', async () => {
    const log = new PersistentCrawlEventLog(P, 'run-bound');
    const hook = new LiveCrawlEventHook(P, 'run-bound', log);
    hook.appendStarted(U);
    await hook.flush();
    expect(capturedWireBatches.every((b) => b.projectId === P && b.runId === 'run-bound')).toBe(true);
  });
});
