import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadCrawlRuns, saveCrawlRuns } from '../src/services/crawlPersistence';
import { buildInterruptedCrawlFromRecoveredRun } from '../src/services/crawlPersistence/recovery';
import { mergeCrawlResults } from '../src/stores/tools/checkpoints/results';
import { parseCrawlRunsStrict } from '../src/services/crawlContracts';
import { createCrawlPageFixture, createCrawlResultFixture, createCrawlRunFixture } from './fixtures/crawl';
import { createMockTauriTransport, createWireEvent } from './crawlRecoveryMissingEvidenceFixture';

const mockNative = vi.hoisted(() => ({ invokeTauriCommand: vi.fn(), isTauriEnvironment: () => true }));
vi.mock('../src/services/tauri', () => mockNative);

describe('Issue #138: Crawl Recovery Missing Evidence & Persistence Boundaries', () => {
  beforeEach(() => {
    mockNative.invokeTauriCommand.mockReset();
    localStorage.clear();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('missing evidence in native events does not invent defaults (health 0, default config, new Date)', async () => {
    const proj = 'proj-missing-evidence';
    const runId = 'run-missing-ev';
    const events = [
      createWireEvent(proj, runId, 1, 'crawl:started', '2026-10-25T10:00:00Z', { startUrl: 'https://example.test/' }),
      createWireEvent(proj, runId, 2, 'crawl:page', '2026-10-25T10:01:00Z', createCrawlPageFixture({ url: 'https://example.test/p1' })),
      createWireEvent(proj, runId, 3, 'crawl:completed', '2026-10-25T10:02:00Z', { duration_ms: 60000 }),
    ];
    mockNative.invokeTauriCommand.mockImplementation(createMockTauriTransport({ events }).invokeTauriCommand);

    const runs = await loadCrawlRuns(proj);
    expect(runs).toHaveLength(1);
    const rec = runs[0];

    // Honest lack of evidence must remain undefined, NOT false metrics or fallback objects
    expect(rec.result.health_score).toBeUndefined();
    expect(rec.config).toBeUndefined();
    expect((rec as any).startedAt).toBe('2026-10-25T10:00:00Z');

    // Replay into interrupted crawl must not invent default config
    const interrupted = buildInterruptedCrawlFromRecoveredRun(rec as any);
    expect(interrupted.config).toBeUndefined();

    // In-flight without crawl:started event must keep startedAt undefined, not synthesize new Date()
    const projNoStart = 'proj-no-start';
    const noStartEvents = [
      createWireEvent(projNoStart, 'run-no-start', 1, 'crawl:page', '2026-10-25T10:01:00Z', createCrawlPageFixture({ url: 'https://example.test/p1' })),
    ];
    mockNative.invokeTauriCommand.mockImplementation(createMockTauriTransport({ events: noStartEvents }).invokeTauriCommand);

    const runsNoStart = await loadCrawlRuns(projNoStart);
    expect((runsNoStart[0] as any).startedAt).toBeUndefined();
    const interruptedNoStart = buildInterruptedCrawlFromRecoveredRun(runsNoStart[0] as any);
    expect(interruptedNoStart.startedAt).toBeUndefined();
  });

  it('partial completed run is rejected by strict schema and not promoted to completed snapshot', async () => {
    const proj = 'proj-partial-evidence';
    const runId = 'run-partial-ev';
    const events = [
      createWireEvent(proj, runId, 1, 'crawl:started', '2026-10-25T10:00:00Z', { startUrl: 'https://example.test/' }),
      createWireEvent(proj, runId, 2, 'crawl:completed', '2026-10-25T10:05:00Z', { duration_ms: 5000 }),
    ];
    mockNative.invokeTauriCommand.mockImplementation(createMockTauriTransport({ events }).invokeTauriCommand);

    const runs = await loadCrawlRuns(proj);
    expect(runs).toHaveLength(1);
    const rec = runs[0];

    // Incomplete payload without valid config or health_score must not be treated as completed
    expect((rec as any).status).not.toBe('completed');
    expect(['in-flight', 'interrupted']).toContain((rec as any).status);

    // Strict schema must reject partial recovery record from durable storage
    expect(() => parseCrawlRunsStrict([rec])).toThrow();
  });

  it('read -> resume -> save preserves 2 loaded pages + 1 new page without persisting recovery DTO', async () => {
    const proj = 'proj-resume-save';
    const baseRunId = 'run-interrupted-base';
    const p1 = createCrawlPageFixture({ url: 'https://example.test/p1', final_url: 'https://example.test/p1' });
    const p2 = createCrawlPageFixture({ url: 'https://example.test/p2', final_url: 'https://example.test/p2' });
    const events = [
      createWireEvent(proj, baseRunId, 1, 'crawl:started', '2026-10-25T10:00:00Z', { startUrl: 'https://example.test/' }),
      createWireEvent(proj, baseRunId, 2, 'crawl:page', '2026-10-25T10:01:00Z', p1),
      createWireEvent(proj, baseRunId, 3, 'crawl:page', '2026-10-25T10:02:00Z', p2),
      createWireEvent(proj, baseRunId, 4, 'crawl:completed', '2026-10-25T10:03:00Z', { duration_ms: 5000 }),
    ];
    mockNative.invokeTauriCommand.mockImplementation(createMockTauriTransport({ events }).invokeTauriCommand);

    // 1. Read: loads recovered in-flight / interrupted run with 2 pages
    const loadedRuns = await loadCrawlRuns(proj);
    expect(loadedRuns).toHaveLength(1);
    const recoveredRun = loadedRuns[0];
    expect(recoveredRun.id).toBe(baseRunId);
    expect(recoveredRun.result.pages).toHaveLength(2);

    // 2. Resume: build interrupted crawl, perform crawl for 3rd page and merge
    const interrupted = buildInterruptedCrawlFromRecoveredRun(recoveredRun as any);
    expect(interrupted.baseRunId).toBe(baseRunId);
    const p3 = createCrawlPageFixture({ url: 'https://example.test/p3', final_url: 'https://example.test/p3' });
    const freshResult = createCrawlResultFixture({ pages: [p3], pages_crawled: 1, duration_ms: 1500 });
    const mergedResult = mergeCrawlResults(interrupted.baseResult!, freshResult);
    expect(mergedResult.pages).toHaveLength(3);

    // 3. Save: new completed record saved; recovered DTO must NOT cause SQLite store rejection
    const resumedCompletedRun = createCrawlRunFixture({
      id: 'run-resumed-finished',
      completedAt: '2026-10-25T11:00:00Z',
      startUrl: 'https://example.test/',
      result: mergedResult,
    });
    const historyWithRecoveryDto = [resumedCompletedRun, recoveredRun as any];

    // Must resolve cleanly and not throw validation error on SQLite store replacement
    await expect(saveCrawlRuns(proj, historyWithRecoveryDto)).resolves.not.toThrow();

    const replaceCall = mockNative.invokeTauriCommand.mock.calls.find((c: any[]) => c[0] === 'store_replace_crawl_runs');
    expect(replaceCall).toBeDefined();
    const persistedRuns = replaceCall![1].runs;

    // Recovery DTO must be excluded from durable SQLite snapshot
    expect(persistedRuns.some((r: any) => r.id === baseRunId)).toBe(false);
    expect(persistedRuns.every((r: any) => Boolean(r.completedAt && r.config && r.result?.pages))).toBe(true);

    // Persisted completed run must retain all 3 pages (2 restored + 1 fresh)
    const savedRun = persistedRuns.find((r: any) => r.id === 'run-resumed-finished');
    expect(savedRun).toBeDefined();
    expect(savedRun.result.pages).toHaveLength(3);
    expect(savedRun.result.pages.map((p: any) => p.url)).toEqual([
      'https://example.test/p1',
      'https://example.test/p2',
      'https://example.test/p3',
    ]);
  });
});
