import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadCrawlRuns, saveCrawlRuns } from '../src/services/crawlPersistence';
import { replayLatestRunEvents } from '../src/services/snapshots';
import { createCrawlRunFixture } from './fixtures/crawl';

const native = vi.hoisted(() => ({
  invokeTauriCommand: vi.fn(),
  isTauriEnvironment: () => true,
}));
vi.mock('../src/services/tauri', () => native);

describe('Issue #138: EventLog Restart, Replay & IPC Wiring', () => {
  beforeEach(() => {
    native.invokeTauriCommand.mockReset();
    localStorage.clear();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('saveCrawlRuns appends live events to SQLite via IPC and throws on DB failure', async () => {
    const run = createCrawlRunFixture({ id: 'run-desktop-1' });
    native.invokeTauriCommand.mockImplementation(async (cmd: string) => {
      if (cmd === 'load_project_crawl_runs') return [];
      if (cmd === 'store_load_crawl_events') return [];
      if (cmd === 'store_append_crawl_events') return 2;
      if (cmd === 'store_replace_crawl_runs') return undefined;
      return undefined;
    });

    const result = await saveCrawlRuns('proj-live', [run]);
    expect(result).toEqual({ prunedRuns: 0 });
    expect(native.invokeTauriCommand).toHaveBeenCalledWith(
      'store_append_crawl_events',
      expect.objectContaining({
        projectId: 'proj-live',
        runId: 'run-desktop-1',
        events: expect.arrayContaining([
          expect.objectContaining({ eventType: 'crawl:started' }),
        ]),
      }),
    );

    // DB failure on event append must throw and NOT be swallowed
    native.invokeTauriCommand.mockImplementation(async (cmd: string) => {
      if (cmd === 'load_project_crawl_runs') return [];
      if (cmd === 'store_load_crawl_events') return [];
      if (cmd === 'store_append_crawl_events') throw new Error('SQLite disk full');
      return undefined;
    });
    await expect(saveCrawlRuns('proj-live', [run])).rejects.toThrow('SQLite disk full');
  });

  it('restart replay reconstructs projection and isolates projects', async () => {
    const runA = createCrawlRunFixture({ id: 'run-a' });
    const runB = createCrawlRunFixture({ id: 'run-b' });

    native.invokeTauriCommand.mockImplementation(async (cmd: string, args: any) => {
      if (cmd === 'load_project_crawl_runs') return [];
      if (cmd === 'store_list_crawl_runs') {
        if (args?.projectId === 'proj-A') {
          return [{ id: 'run-a', completedAt: '2026', startUrl: 'https://a.test', pageCount: 0 }];
        }
        return [{ id: 'run-b', completedAt: '2026', startUrl: 'https://b.test', pageCount: 0 }];
      }
      if (cmd === 'store_load_crawl_run') return args?.projectId === 'proj-A' ? runA : runB;
      if (cmd === 'store_load_crawl_events') {
        if (args?.projectId === 'proj-A') {
          return [{
            projectId: 'proj-A', runId: 'run-a', seq: 1, eventType: 'crawl:started',
            at: '2026', payload: { domain: 'a.test' },
          }];
        }
        return [{
          projectId: 'proj-B', runId: 'run-b', seq: 1, eventType: 'crawl:started',
          at: '2026', payload: { domain: 'b.test' },
        }];
      }
      return undefined;
    });

    const runsA = await loadCrawlRuns('proj-A');
    expect(runsA[0].id).toBe('run-a');

    const latestA = await replayLatestRunEvents('proj-A');
    expect(latestA.runId).toBe('run-a');
    expect(latestA.log.allEvents()[0].payload).toEqual({ domain: 'a.test' });

    const latestB = await replayLatestRunEvents('proj-B');
    expect(latestB.runId).toBe('run-b');
    expect(latestB.log.allEvents()[0].payload).toEqual({ domain: 'b.test' });
  });

  it('detects and rejects conflicting payloads on replay or re-save', async () => {
    const run = createCrawlRunFixture({ id: 'run-conflict' });
    native.invokeTauriCommand.mockImplementation(async (cmd: string) => {
      if (cmd === 'load_project_crawl_runs') return [];
      if (cmd === 'store_load_crawl_events') return [];
      if (cmd === 'store_append_crawl_events') {
        throw new Error('Sequence conflict at seq 1: distinct data.');
      }
      return undefined;
    });

    await expect(saveCrawlRuns('p-err', [run])).rejects.toThrow('Sequence conflict');
  });
});
