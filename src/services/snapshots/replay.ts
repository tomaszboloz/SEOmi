import type { CrawlRunRecord } from '@/types';
import { listStoredRuns, loadStoredRun } from '@/services/crawlStore';
import { CrawlEventLog, type CrawlEvent } from './eventLog';
import { fetchCrawlEvents, persistCrawlEvents } from './sqliteEventSink';

export type EventProvenance = 'checkpoint-derived' | 'live-crawl';

const objectPayload = (event: CrawlEvent): Record<string, unknown> | null =>
  event.payload && typeof event.payload === 'object' ? event.payload as Record<string, unknown> : null;

export const buildSyntheticEventsFromRun = (run: CrawlRunRecord, provenance: EventProvenance = 'checkpoint-derived'): CrawlEvent[] => {
  const projectId = run.projectId;
  const startedAt = run.startedAt && Number.isFinite(Date.parse(run.startedAt)) ? run.startedAt : run.completedAt;
  const identity = { projectId, runId: run.id };
  const pages = run.result?.pages ?? [];
  return [
    { ...identity, seq: 1, type: 'crawl:started', at: startedAt, payload: { id: run.id, runId: run.id, projectId, startUrl: run.startUrl, startedAt, config: run.config, provenance } },
    ...pages.map((page, index) => ({ ...identity, seq: index + 2, type: 'crawl:page', at: run.completedAt, payload: { ...page, runId: run.id, projectId, provenance } })),
    { ...identity, seq: pages.length + 2, type: 'crawl:completed', at: run.completedAt, payload: { id: run.id, runId: run.id, projectId, completedAt: run.completedAt, pageCount: pages.length, startUrl: run.startUrl, health_score: run.result.health_score, duration_ms: run.result.duration_ms, provenance } },
  ];
};

export const fetchAllCrawlEvents = async (projectId: string, runId: string, batchSize = 10_000): Promise<CrawlEvent[]> => {
  const all: CrawlEvent[] = [];
  let fromSeq = 1;
  let effectiveRunId = runId;
  while (true) {
    const batch = await fetchCrawlEvents(projectId, effectiveRunId, fromSeq, batchSize);
    if (!batch.length) break;
    const batchRun = batch[0].runId;
    if (!batchRun || batch.some((event) => event.runId !== batchRun || event.projectId !== projectId)) throw new Error('Crawl event identity mismatch.');
    if (!effectiveRunId) effectiveRunId = batchRun;
    all.push(...batch);
    if (batch.length < batchSize) break;
    fromSeq = batch[batch.length - 1].seq + 1;
  }
  return all;
};

const assertContiguous = (projectId: string, runId: string, events: readonly CrawlEvent[]): void => {
  events.forEach((event, index) => {
    if (event.seq !== index + 1 || event.projectId !== projectId || event.runId !== runId) throw new Error(`Corrupted crawl event sequence for project ${projectId} run ${runId}.`);
  });
};

export const replayCrawlEvents = async (projectId: string, runId: string): Promise<CrawlEventLog> => {
  const existing = await fetchAllCrawlEvents(projectId, runId);
  if (existing.length) {
    assertContiguous(projectId, runId, existing);
    return new CrawlEventLog(existing, { projectId, runId });
  }
  const legacy = await loadStoredRun(projectId, runId);
  if (!legacy) return new CrawlEventLog([], { projectId, runId });
  const synthetic = buildSyntheticEventsFromRun({ ...legacy, projectId }, 'checkpoint-derived');
  await persistCrawlEvents(projectId, runId, synthetic);
  return new CrawlEventLog(synthetic, { projectId, runId });
};

export const replayLatestRunEvents = async (projectId: string): Promise<{ runId: string | null; log: CrawlEventLog }> => {
  const [summaries, events] = await Promise.all([listStoredRuns(projectId), fetchAllCrawlEvents(projectId, '')]);
  const eventRunId = events[0]?.runId;
  if (events.length && eventRunId) {
    assertContiguous(projectId, eventRunId, events);
    const latest = summaries[0];
    const latestAt = latest ? Date.parse(latest.completedAt) : 0;
    const eventAt = Date.parse(events.at(-1)?.at || '');
    const terminal = events.some((event) => event.type === 'crawl:completed');
    if (!latest || eventRunId !== latest.id || !terminal || !Number.isFinite(latestAt) || eventAt >= latestAt) {
      return { runId: eventRunId, log: new CrawlEventLog(events, { projectId, runId: eventRunId }) };
    }
  }
  if (summaries[0]) return { runId: summaries[0].id, log: await replayCrawlEvents(projectId, summaries[0].id) };
  return { runId: null, log: new CrawlEventLog([], { projectId }) };
};

export const eventPayload = objectPayload;
