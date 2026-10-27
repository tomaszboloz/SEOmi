import { CrawlEventLog, type CrawlEvent } from './eventLog';
import { fetchCrawlEvents, persistCrawlEvents } from './sqliteEventSink';
import { listStoredRuns, loadStoredRun } from '@/services/crawlStore';
import type { CrawlRunRecord } from '@/types';

export type EventProvenance = 'checkpoint-derived' | 'live-crawl';

export const buildSyntheticEventsFromRun = (
  run: CrawlRunRecord,
  provenance: EventProvenance = 'checkpoint-derived',
): CrawlEvent[] => {
  const startedAt = (run as { startedAt?: string }).startedAt ?? run.completedAt;
  const events: CrawlEvent[] = [];
  events.push({
    seq: 1,
    type: 'crawl:started',
    at: startedAt,
    payload: { id: run.id, startUrl: run.startUrl, startedAt, provenance },
  });
  const pages = run.result?.pages ?? [];
  pages.forEach((page, index) => {
    events.push({
      seq: index + 2,
      type: 'crawl:page',
      at: run.completedAt,
      payload: { ...page, provenance },
    });
  });
  events.push({
    seq: pages.length + 2,
    type: 'crawl:completed',
    at: run.completedAt,
    payload: {
      id: run.id,
      completedAt: run.completedAt,
      pageCount: pages.length,
      startUrl: run.startUrl,
      provenance,
    },
  });
  return events;
};

/** Paginates sequentially through all events in SQLite until complete. */
export const fetchAllCrawlEvents = async (
  projectId: string,
  runId: string,
  batchSize = 10_000,
): Promise<CrawlEvent[]> => {
  const all: CrawlEvent[] = [];
  let fromSeq = 1;
  let effectiveRunId = runId;
  while (true) {
    const batch = await fetchCrawlEvents(projectId, effectiveRunId, fromSeq, batchSize);
    if (!batch.length) break;
    if (!effectiveRunId && batch[0].runId) {
      effectiveRunId = batch[0].runId;
    }
    all.push(...batch);
    if (batch.length < batchSize) break;
    fromSeq = batch[batch.length - 1].seq + 1;
  }
  return all;
};

const assertContiguousEvents = (projectId: string, runId: string, events: readonly CrawlEvent[]): void => {
  for (let i = 0; i < events.length; i++) {
    if (events[i].seq !== i + 1) {
      throw new Error(
        `Corrupted crawl event sequence for project ${projectId} run ${runId}: expected seq ${i + 1}, got ${events[i].seq}`,
      );
    }
  }
};

export const replayCrawlEvents = async (
  projectId: string,
  runId: string,
): Promise<CrawlEventLog> => {
  const existing = await fetchAllCrawlEvents(projectId, runId);
  if (existing.length > 0) {
    assertContiguousEvents(projectId, runId, existing);
    return new CrawlEventLog(existing);
  }
  const legacyRun = await loadStoredRun(projectId, runId);
  if (!legacyRun) return new CrawlEventLog();

  const synthetic = buildSyntheticEventsFromRun(legacyRun, 'checkpoint-derived');
  await persistCrawlEvents(projectId, runId, synthetic);
  return new CrawlEventLog(synthetic);
};

export const replayLatestRunEvents = async (
  projectId: string,
): Promise<{ runId: string | null; log: CrawlEventLog }> => {
  const [summaries, inFlight] = await Promise.all([
    listStoredRuns(projectId),
    fetchAllCrawlEvents(projectId, ''),
  ]);

  const p0 = inFlight[0]?.payload as Record<string, unknown> | undefined;
  const inFlightRunId = inFlight[0]?.runId
    ?? (p0?.id !== undefined && p0?.id !== null ? String(p0.id) : null)
    ?? (p0?.runId !== undefined && p0?.runId !== null ? String(p0.runId) : null)
    ?? (inFlight.length > 0 ? 'in-flight-run' : null);

  const inFlightLast = inFlight[inFlight.length - 1];
  const inFlightAt = inFlightLast?.at ? new Date(inFlightLast.at).getTime() : 0;
  const latestSummary = summaries[0];
  const summaryAt = latestSummary
    ? new Date((latestSummary as { completedAt?: string; startedAt?: string }).startedAt || latestSummary.completedAt || 0).getTime()
    : 0;

  if (inFlight.length > 0 && inFlightRunId) {
    if (!latestSummary || inFlightAt >= summaryAt || inFlightRunId !== latestSummary.id) {
      assertContiguousEvents(projectId, inFlightRunId, inFlight);
      return { runId: inFlightRunId, log: new CrawlEventLog(inFlight) };
    }
  }

  if (latestSummary) {
    const log = await replayCrawlEvents(projectId, latestSummary.id);
    return { runId: latestSummary.id, log };
  }

  return { runId: null, log: new CrawlEventLog() };
};
