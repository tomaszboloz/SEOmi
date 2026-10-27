import { describe, expect, it, vi, beforeEach } from 'vitest';
import { PersistentCrawlEventLog, replayCrawlEvents, replayLatestRunEvents } from '../src/services/snapshots';
import * as sinkModule from '../src/services/snapshots/sqliteEventSink';
import * as storeModule from '../src/services/crawlStore';
import type { CrawlEvent } from '../src/services/snapshots/eventLog';

vi.mock('../src/services/snapshots/sqliteEventSink', () => ({
  fetchCrawlEvents: vi.fn(),
  persistCrawlEvents: vi.fn(),
}));

vi.mock('../src/services/crawlStore', () => ({
  listStoredRuns: vi.fn(),
  loadStoredRun: vi.fn(),
}));

describe('Issue #138: Boundary conditions, Pagination >10k and Queue Recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('drains queue on second append/flush after first storage failure without permanent rejection', async () => {
    let writes = 0;
    vi.mocked(sinkModule.persistCrawlEvents).mockImplementation(async () => {
      writes++;
      if (writes === 1) throw new Error('fixture disk full');
      return 2;
    });

    const log = new PersistentCrawlEventLog('p', 'r');
    log.append('crawl:started', { url: 'https://site.test' });

    let firstError: string | undefined;
    try {
      await log.flush();
    } catch (e) {
      firstError = String(e);
    }
    expect(firstError).toContain('fixture disk full');

    log.append('crawl:page', { url: 'https://site.test/a' });
    let secondError: string | undefined;
    try {
      await log.flush();
    } catch (e) {
      secondError = String(e);
    }

    expect(secondError).toBeUndefined();
    expect(writes).toBe(2);
    expect(log.allEvents()).toHaveLength(2);
  });

  it('paginates over 10,000 events without silent truncation', async () => {
    const total = 10002;
    const events: CrawlEvent[] = Array.from({ length: total }, (_, i) => ({
      seq: i + 1,
      type: i === 0 ? 'crawl:started' : i === total - 1 ? 'crawl:completed' : 'crawl:page',
      at: '2026-10-24T10:00:00.000Z',
      payload: { id: i },
    }));

    let fetches = 0;
    vi.mocked(sinkModule.fetchCrawlEvents).mockImplementation(async (_p, _r, from = 1, limit = 10000) => {
      fetches++;
      return events.slice(from - 1, from - 1 + limit);
    });

    const log = await replayCrawlEvents('p', 'r');
    expect(log.allEvents()).toHaveLength(10002);
    expect(fetches).toBe(2);
    expect(log.allEvents()[total - 1].type).toBe('crawl:completed');
  });

  it('discovers in-flight run from durable events when completed run snapshot is missing', async () => {
    vi.mocked(storeModule.listStoredRuns).mockResolvedValueOnce([]);
    const events: CrawlEvent[] = [
      { seq: 1, type: 'crawl:started', at: '2026-10-24T10:00:00Z', payload: { id: 'in-flight-99', startUrl: 'https://inf.test' } },
      { seq: 2, type: 'crawl:page', at: '2026-10-24T10:00:01Z', payload: { url: 'https://inf.test/p1' } },
    ];
    vi.mocked(sinkModule.fetchCrawlEvents).mockResolvedValueOnce(events);

    const restored = await replayLatestRunEvents('p');
    expect(restored.runId).toBe('in-flight-99');
    expect(restored.log.allEvents()).toHaveLength(2);
  });
});
