import { vi } from 'vitest';
import type { StoredCrawlEventWire } from '../src/services/snapshots/sqliteEventSink';

export const createWireEvent = (
  projectId: string,
  runId: string,
  seq: number,
  eventType: string,
  at: string,
  payload: unknown = {},
): StoredCrawlEventWire => ({
  projectId,
  runId,
  seq,
  eventType,
  at,
  payload,
});

export interface MockTransportOptions {
  events?: StoredCrawlEventWire[];
  storedRuns?: unknown[];
}

export const createMockTauriTransport = (options: MockTransportOptions = {}) => {
  const eventsByProject = new Map<string, StoredCrawlEventWire[]>();
  if (options.events) {
    for (const ev of options.events) {
      const list = eventsByProject.get(ev.projectId) || [];
      list.push(ev);
      eventsByProject.set(ev.projectId, list);
    }
  }

  const invokeTauriCommand = vi.fn(async (cmd: string, args: any) => {
    if (cmd === 'load_project_crawl_runs') return [];
    if (cmd === 'store_list_crawl_runs') {
      return (options.storedRuns || []).map((r: any) => ({
        id: r.id,
        completedAt: r.completedAt,
        startUrl: r.startUrl,
        pageCount: r.result?.pages?.length ?? 0,
      }));
    }
    if (cmd === 'store_load_crawl_run') {
      return (options.storedRuns || []).find((r: any) => r.id === args?.runId) ?? null;
    }
    if (cmd === 'store_load_crawl_events') {
      const list = eventsByProject.get(args?.projectId) || [];
      if (!args?.runId) return list;
      return list.filter((e) => e.runId === args.runId);
    }
    if (cmd === 'store_append_crawl_events') return (args?.events?.length ?? 1);
    if (cmd === 'store_replace_crawl_runs') return undefined;
    if (cmd === 'store_import_legacy_runs') return 0;
    return undefined;
  });

  return {
    invokeTauriCommand,
    isTauriEnvironment: () => true,
  };
};
