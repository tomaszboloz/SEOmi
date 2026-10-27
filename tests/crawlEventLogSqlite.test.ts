import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  CrawlEventLog,
  PersistentCrawlEventLog,
  openSimulationSession,
  persistCrawlEvents,
  replayCrawlEvents,
} from '@/services/snapshots';
import * as tauriModule from '@/services/tauri';
import * as crawlStoreModule from '@/services/crawlStore';
import type { CrawlRunRecord } from '@/types';

vi.mock('@/services/tauri', () => ({
  isTauriEnvironment: vi.fn(),
  invokeTauriCommand: vi.fn(),
}));

vi.mock('@/services/crawlStore', () => ({
  listStoredRuns: vi.fn(),
  loadStoredRun: vi.fn(),
}));

describe('Issue #138: SQLite Append-Only Crawl Event Log & Replay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects persistence when not in Tauri environment and surfaces IPC failure', async () => {
    vi.mocked(tauriModule.isTauriEnvironment).mockReturnValue(false);
    await expect(persistCrawlEvents('p1', 'r1', [{ seq: 1, type: 'init', at: '2026', payload: {} }]))
      .rejects.toThrow('Durable SQLite event persistence requires Tauri environment');

    vi.mocked(tauriModule.isTauriEnvironment).mockReturnValue(true);
    vi.mocked(tauriModule.invokeTauriCommand).mockRejectedValueOnce(new Error('Disk I/O error'));
    await expect(persistCrawlEvents('p1', 'r1', [{ seq: 1, type: 'init', at: '2026', payload: {} }]))
      .rejects.toThrow('Disk I/O error');
  });

  it('persistent log flushes ordered batch to SQLite and retains pending on failure for rollback', async () => {
    vi.mocked(tauriModule.isTauriEnvironment).mockReturnValue(true);
    const invokeSpy = vi.mocked(tauriModule.invokeTauriCommand).mockResolvedValue(1);

    const log = new PersistentCrawlEventLog('proj-A', 'run-1');
    log.append('crawl:started', { url: 'https://test.io' });
    await log.flush();

    expect(invokeSpy).toHaveBeenCalledWith('store_append_crawl_events', expect.objectContaining({
      projectId: 'proj-A',
      runId: 'run-1',
      events: [expect.objectContaining({ seq: 1, eventType: 'crawl:started' })],
    }));

    invokeSpy.mockRejectedValueOnce(new Error('Storage busy'));
    log.append('crawl:page', { url: 'https://test.io/1' });
    await expect(log.flush()).rejects.toThrow('Storage busy');
    // Events retained in log
    expect(log.allEvents()).toHaveLength(2);
  });

  it('replays stored events into a fresh event log with project/run isolation', async () => {
    vi.mocked(tauriModule.isTauriEnvironment).mockReturnValue(true);
    vi.mocked(tauriModule.invokeTauriCommand).mockResolvedValueOnce([
      { projectId: 'proj-A', runId: 'run-1', seq: 1, eventType: 'crawl:started', at: '2026', payload: { start: true } },
      { projectId: 'proj-A', runId: 'run-1', seq: 2, eventType: 'crawl:page', at: '2026', payload: { url: '/a' } },
    ]);

    const log = await replayCrawlEvents('proj-A', 'run-1');
    expect(log.revision).toBe(2);
    expect(log.allEvents()[1].payload).toEqual({ url: '/a' });
  });

  it('migrates legacy crawl run into synthetic SQLite events when no prior log exists', async () => {
    vi.mocked(tauriModule.isTauriEnvironment).mockReturnValue(true);
    vi.mocked(tauriModule.invokeTauriCommand).mockResolvedValueOnce([]); // No existing events
    const legacy: CrawlRunRecord = {
      id: 'legacy-run-99',
      startUrl: 'https://legacy.test',
      completedAt: '2026-10-24T10:00:00Z',
      config: {} as any,
      result: { pages: [{ url: 'https://legacy.test/p1' } as any] } as any,
    };
    vi.mocked(crawlStoreModule.loadStoredRun).mockResolvedValueOnce(legacy);

    const log = await replayCrawlEvents('proj-legacy', 'legacy-run-99');
    expect(log.revision).toBe(3); // started, page 1, completed
    expect(log.allEvents()[0].type).toBe('crawl:started');
    expect(log.allEvents()[1].type).toBe('crawl:page');
    expect(log.allEvents()[2].type).toBe('crawl:completed');
  });

  it('10k concurrent page capture does not mutate open WhatIf snapshot and marks session stale', () => {
    const log = new CrawlEventLog();
    log.append('page', { id: 'p0', score: 10 });

    type State = { pages: string[]; totalScore: number };
    const reducer = (state: State, ev: any): State => ({
      pages: [...state.pages, ev.payload.id],
      totalScore: state.totalScore + (ev.payload.score ?? 0),
    });
    const initial = (): State => ({ pages: [], totalScore: 0 });

    const session = openSimulationSession(log, reducer, initial);
    expect(session.snapshot).toEqual({ pages: ['p0'], totalScore: 10 });
    expect(session.isStale()).toBe(false);

    // Simulate 10,000 concurrent page events incoming in background crawl
    for (let i = 1; i <= 10_000; i++) {
      log.append('page', { id: `p${i}`, score: 1 });
    }

    // Open WhatIf snapshot is strictly immutable and unchanged
    expect(session.snapshot).toEqual({ pages: ['p0'], totalScore: 10 });
    expect(session.isStale()).toBe(true);
    expect(Object.isFrozen(session.snapshot)).toBe(true);

    // Refresh produces a detached updated snapshot
    const refreshed = session.refresh();
    expect(refreshed.isStale()).toBe(false);
    expect(refreshed.snapshot.pages.length).toBe(10_001);
    expect(refreshed.snapshot.totalScore).toBe(10 + 10_000);
    // Old session remains untouched
    expect(session.snapshot.pages.length).toBe(1);
  });
});
