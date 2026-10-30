import { afterEach, expect, it, vi } from 'vitest';
import { attachCrawlLog, closeInterruptedCrawlLog, listOpenCrawlLogs, loadCrawlLog, replayCrawlLog, takeRecoveredBase } from '@/services/crawlEvents';
import type { CrawlLogEvent } from '@/services/crawlEvents';
import { DEFAULT_CRAWL_CONFIG } from '@/services/contracts/crawlDefaults';
import type { InterruptedCrawl } from '@/stores/tools/contracts';
import { createCrawlPageFixture } from './fixtures/crawl';

const native = vi.hoisted(() => ({ invokeTauriCommand: vi.fn(), isTauriEnvironment: () => true }));
vi.mock('@/services/tauri', () => native);
afterEach(() => native.invokeTauriCommand.mockReset());

const page = (url: string, links: string[] = []) => createCrawlPageFixture({ url, final_url: url, links: links.map((target_url) => ({ target_url, anchor_text: '', is_internal: true })) });
const started = (at = 1_000): CrawlLogEvent => ({ seq: 1, kind: 'started', at_ms: at, payload: { start_url: 'https://e.test/', limit: 5 } });
const log = (...pages: unknown[]): CrawlLogEvent[] => [started(), ...pages.map((p, i) => ({ seq: i + 2, kind: 'page', at_ms: 1_000 + (i + 1) * 500, payload: { page: p } }))];
const checkpoint = (patch: Partial<InterruptedCrawl> = {}): InterruptedCrawl => ({ runId: 'run-1', url: 'https://e.test/', limit: 5, config: DEFAULT_CRAWL_CONFIG,
  environment: 'default', startedAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z', ...patch });

/** Fake native store: pages of `size` events for one run, plus the open-run list. */
const serve = (events: CrawlLogEvent[], size = 2, open = [{ run_id: 'run-1', last_seq: events.length, pages: events.length - 1, started_at_ms: 1, last_at_ms: 2 }]) =>
  native.invokeTauriCommand.mockImplementation(async (cmd: string, args: { runId: string; afterSeq: number; limit: number }) => {
    if (cmd === 'store_list_open_crawl_event_runs') return open;
    if (cmd === 'store_close_interrupted_crawl_events') return undefined;
    const rest = events.filter((event) => event.seq > args.afterSeq);
    return { run_id: args.runId, events: rest.slice(0, size), has_more: rest.length > size };
  });

it('pages through one pinned run and rejects gaps, foreign pages and endless paging', async () => {
  serve(log(page('https://e.test/'), page('https://e.test/a')));
  expect((await loadCrawlLog('p', 'run-1')).map((event) => event.seq)).toEqual([1, 2, 3]);
  expect(native.invokeTauriCommand).toHaveBeenCalledWith('store_load_crawl_events', { projectId: 'p', runId: 'run-1', afterSeq: 2, limit: 500 });
  serve([started(), { seq: 3, kind: 'page', at_ms: 1, payload: {} }]);
  await expect(loadCrawlLog('p', 'run-1')).rejects.toThrow('gap after event 1');
  native.invokeTauriCommand.mockResolvedValueOnce({ run_id: 'run-2', events: [], has_more: false });
  await expect(loadCrawlLog('p', 'run-1')).rejects.toThrow('invalid page');
  native.invokeTauriCommand.mockResolvedValueOnce({ run_id: 'run-1', events: [], has_more: true });
  await expect(loadCrawlLog('p', 'run-1')).rejects.toThrow('did not finish paging');
  await expect(loadCrawlLog('p', '')).rejects.toThrow('explicit run id');
});

it('lists only well-formed open runs and closes a log with the current time', async () => {
  native.invokeTauriCommand.mockResolvedValueOnce([{ run_id: 'a', last_seq: 2, pages: 1, started_at_ms: 1, last_at_ms: 2 }, { run_id: '', last_seq: 1 }, null]);
  expect((await listOpenCrawlLogs('p')).map((run) => run.run_id)).toEqual(['a']);
  native.invokeTauriCommand.mockResolvedValueOnce({});
  await expect(listOpenCrawlLogs('p')).rejects.toThrow('invalid run list');
  native.invokeTauriCommand.mockResolvedValueOnce(undefined);
  await closeInterruptedCrawlLog('p', 'a', () => 42);
  expect(native.invokeTauriCommand).toHaveBeenLastCalledWith('store_close_interrupted_crawl_events', { projectId: 'p', runId: 'a', atMs: 42 });
});

it('replays logged pages, counts unreadable ones and refuses closed or headless logs', () => {
  const recovered = replayCrawlLog('run-1', [...log(page('https://e.test/'), { url: 42 }), { seq: 4, kind: 'note', at_ms: 9_000, payload: null }]);
  expect(recovered).toMatchObject({ startUrl: 'https://e.test/', startedAtMs: 1_000, lastAtMs: 9_000, invalidPages: 1 });
  expect(recovered.pages.map((p) => p.url)).toEqual(['https://e.test/']);
  expect(() => replayCrawlLog('run-1', [])).toThrow('started event');
  expect(() => replayCrawlLog('run-1', [{ ...started(), payload: null }])).toThrow('started event');
  expect(() => replayCrawlLog('run-1', [...log(), { seq: 2, kind: 'cancelled', at_ms: 2, payload: null }])).toThrow('already cancelled');
});

it('attaches logged pages to the checkpoint of the same run only', async () => {
  serve(log(page('https://e.test/', ['https://e.test/a', 'https://e.test/b']), page('https://e.test/a')));
  const attached = await attachCrawlLog('p', checkpoint({ completedUrls: ['https://e.test/old'] }), () => false);
  expect(attached).toMatchObject({ recoveredRunId: 'run-1', recoveredPages: 2, recoveredInvalidPages: 0 });
  expect(attached?.completedUrls).toEqual(['https://e.test/old', 'https://e.test/', 'https://e.test/a']);
  expect(attached?.frontierUrls).toEqual(['https://e.test/b']);
  native.invokeTauriCommand.mockClear();
  const live = checkpoint();
  expect(await attachCrawlLog('p', live, (runId) => runId === 'run-1')).toBe(live);
  expect(await attachCrawlLog('p', null, () => false)).toBeNull();
  const legacy = checkpoint({ runId: undefined });
  expect(await attachCrawlLog('p', legacy, () => false)).toBe(legacy);
  const cancelled = checkpoint({ baseRunId: 'saved' });
  expect(await attachCrawlLog('p', cancelled, () => false)).toBe(cancelled);
  expect(native.invokeTauriCommand).not.toHaveBeenCalled();
  serve(log(page('https://e.test/')), 2, []);
  const other = checkpoint();
  expect(await attachCrawlLog('p', other, () => false)).toBe(other);
});

it('takes the recovered base once: logged span as duration, then closes the log', async () => {
  serve(log(page('https://e.test/'), page('https://e.test/a')));
  const base = await takeRecoveredBase('p', 'run-1');
  expect(base).toMatchObject({ start_url: 'https://e.test/', duration_ms: 1_000 });
  expect(base.pages).toHaveLength(2);
  expect(native.invokeTauriCommand).toHaveBeenLastCalledWith('store_close_interrupted_crawl_events', expect.objectContaining({ projectId: 'p', runId: 'run-1' }));
  native.invokeTauriCommand.mockReset();
  native.invokeTauriCommand.mockRejectedValue(new Error('store offline'));
  await expect(takeRecoveredBase('p', 'run-1')).rejects.toThrow('store offline');
});
