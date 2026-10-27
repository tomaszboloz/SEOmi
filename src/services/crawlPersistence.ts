import type { CrawlRunRecord } from '@/types';
import { isTauriEnvironment } from '@/services/tauri';
import { indexedDbWrite } from './crawlPersistence/browser';
import { indexedDbRead } from './crawlPersistence/indexedDb';
import { clearLegacyCrawlStorage } from './crawlPersistence/legacy';
import { loadStoredRuns, migrateLegacyCrawlRuns, saveStoredRuns } from './crawlStore';
import { fetchCrawlEvents, replayLatestRunEvents, buildSyntheticEventsFromRun, persistCrawlEvents } from './snapshots';
import { reconstructInFlightRun, type RecoveredActiveCrawlRun } from './crawlPersistence/recovery';
import {
  assertCrawlWriteGeneration,
  crawlWriteGeneration,
  withCrawlWriteLock,
} from './crawlPersistence/writeLock';
import type { CrawlSaveResult } from './crawlPersistence/contracts';

export type { CrawlSaveResult } from './crawlPersistence/contracts';
export { encodeCrawlRunsForStorage, decodeCrawlRunsFromStorage } from './crawlPersistence/codec';
export { compactCrawlRunsForStorage } from './crawlPersistence/compaction';
export { crawlQuotaRetryCounts, isStorageQuotaError } from './crawlPersistence/quota';
export { buildInterruptedCrawlFromRecoveredRun, reconstructInFlightRun, type RecoveredActiveCrawlRun, type RecoveredCrawlResult } from './crawlPersistence/recovery';
export { replayCrawlEvents, replayLatestRunEvents } from './snapshots';

/**
 * Returns whether crawl history is stored outside the legacy localStorage
 * compatibility slot. The browser fallback intentionally keeps that slot as
 * its durable store when IndexedDB is unavailable.
 */
export const usesDedicatedCrawlStorage = (): boolean => isTauriEnvironment() || typeof indexedDB !== 'undefined';

export const loadCrawlRuns = async (projectId: string): Promise<CrawlRunRecord[]> => {
  if (!isTauriEnvironment()) return indexedDbRead(projectId);
  return withCrawlWriteLock(projectId, async () => {
    await migrateLegacyCrawlRuns(projectId);
    const runs = await loadStoredRuns(projectId);
    await replayLatestRunEvents(projectId);
    return runs;
  });
};

export const loadRecoveredCrawl = async (projectId: string): Promise<RecoveredActiveCrawlRun | null> => {
  if (!isTauriEnvironment()) return null;
  return withCrawlWriteLock(projectId, async () => {
    const [stored, latest] = await Promise.all([loadStoredRuns(projectId), replayLatestRunEvents(projectId)]);
    if (!latest.runId || !latest.log.allEvents().length) return null;
    const terminal = latest.log.allEvents().some((event) => event.type === 'crawl:completed');
    if (terminal && stored.some((run) => run.id === latest.runId)) return null;
    return reconstructInFlightRun(projectId, latest.runId, latest.log.allEvents());
  });
};

const saveUnlocked = async (projectId: string, runs: CrawlRunRecord[]): Promise<CrawlSaveResult> => {
  if (!isTauriEnvironment()) return indexedDbWrite(projectId, runs);
  // A save can be the first action after restoring a backup or a failed load.
  // Finish migration before replacement or legacy cleanup can discard v1 data.
  await migrateLegacyCrawlRuns(projectId);
  const latest = runs[0];
  if (latest) {
    const existing = await fetchCrawlEvents(projectId, latest.id);
    if (!existing.length) await persistCrawlEvents(projectId, latest.id, buildSyntheticEventsFromRun({ ...latest, projectId }, 'checkpoint-derived'));
    else if (!existing.some((event) => ['crawl:completed', 'crawl:cancelled', 'crawl:timed_out'].includes(event.type))) throw new Error('Cannot persist completed crawl while its durable event log is incomplete.');
  }
  await saveStoredRuns(projectId, runs);
  clearLegacyCrawlStorage(projectId);
  return { prunedRuns: Math.max(0, runs.length - 50) };
};

export const saveCrawlRuns = (projectId: string, runs: CrawlRunRecord[]): Promise<CrawlSaveResult> => {
  const generation = crawlWriteGeneration(projectId);
  return withCrawlWriteLock(projectId, () => {
    assertCrawlWriteGeneration(projectId, generation);
    return saveUnlocked(projectId, runs);
  });
};
