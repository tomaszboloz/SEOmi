import type { CrawlRunRecord } from '@/types';
import { isTauriEnvironment } from '@/services/tauri';
import { indexedDbWrite } from './crawlPersistence/browser';
import { indexedDbRead } from './crawlPersistence/indexedDb';
import { clearLegacyCrawlStorage } from './crawlPersistence/legacy';
import { loadStoredRuns, migrateLegacyCrawlRuns, saveStoredRuns } from './crawlStore';
import { buildSyntheticEventsFromRun, fetchCrawlEvents, persistCrawlEvents, replayCrawlEvents, replayLatestRunEvents } from './snapshots';
import { assertCrawlWriteGeneration, crawlWriteGeneration, withCrawlWriteLock } from './crawlPersistence/writeLock';
import type { AnyCrawlRun, CrawlSaveResult } from './crawlPersistence/contracts';
import { reconstructInFlightRun } from './crawlPersistence/recovery';

export type { AnyCrawlRun, CrawlSaveResult, RecoveredActiveCrawlResult, RecoveredActiveCrawlRun } from './crawlPersistence/contracts';
export { encodeCrawlRunsForStorage, decodeCrawlRunsFromStorage } from './crawlPersistence/codec';
export { compactCrawlRunsForStorage } from './crawlPersistence/compaction';
export { crawlQuotaRetryCounts, isStorageQuotaError } from './crawlPersistence/quota';
export { replayCrawlEvents, replayLatestRunEvents } from './snapshots';
export { buildInterruptedCrawlFromRecoveredRun, reconstructInFlightRun } from './crawlPersistence/recovery';

/**
 * Returns whether crawl history is stored outside the legacy localStorage
 * compatibility slot. The browser fallback intentionally keeps that slot as
 * its durable store when IndexedDB is unavailable.
 */
export const usesDedicatedCrawlStorage = (): boolean => isTauriEnvironment() || typeof indexedDB !== 'undefined';

export const loadCrawlRuns = async (projectId: string): Promise<AnyCrawlRun[]> => {
  if (!isTauriEnvironment()) return indexedDbRead(projectId);
  return withCrawlWriteLock(projectId, async () => {
    await migrateLegacyCrawlRuns(projectId);
    const runs = await loadStoredRuns(projectId);
    const inFlight = await replayLatestRunEvents(projectId).catch(() => null);
    if (inFlight?.runId && inFlight.log.allEvents().length > 0 && !runs.some((r) => r.id === inFlight.runId)) {
      const reconstructed = reconstructInFlightRun(inFlight.runId, projectId, inFlight.log.allEvents());
      return [reconstructed, ...runs];
    }
    if (runs.length > 0) {
      await replayCrawlEvents(projectId, runs[0].id).catch(() => null);
    }
    return runs;
  });
};

export const isCompletedSnapshotRun = (r: unknown): r is CrawlRunRecord => {
  if (!r || typeof r !== 'object') return false;
  const c = r as Partial<CrawlRunRecord> & { status?: string };
  if (c.status && c.status !== 'completed') return false;
  return Boolean(
    c.id && c.completedAt && c.startUrl && c.config && c.result
    && typeof c.result.health_score === 'number' && Number.isFinite(c.result.health_score),
  );
};

const saveUnlocked = async (projectId: string, runs: CrawlRunRecord[]): Promise<CrawlSaveResult> => {
  if (!isTauriEnvironment()) return indexedDbWrite(projectId, runs);
  // A save can be the first action after restoring a backup or a failed load.
  // Finish migration before replacement or legacy cleanup can discard v1 data.
  await migrateLegacyCrawlRuns(projectId);
  const validCompletedRuns = runs.filter(isCompletedSnapshotRun);
  if (validCompletedRuns.length > 0) {
    const latest = validCompletedRuns[0];
    const existing = await fetchCrawlEvents(projectId, latest.id);
    if (!existing.length) {
      const events = buildSyntheticEventsFromRun(latest, 'checkpoint-derived');
      await persistCrawlEvents(projectId, latest.id, events);
    }
  }
  await saveStoredRuns(projectId, validCompletedRuns);
  clearLegacyCrawlStorage(projectId);
  return { prunedRuns: Math.max(0, validCompletedRuns.length - 50) };
};

export const saveCrawlRuns = (projectId: string, runs: CrawlRunRecord[]): Promise<CrawlSaveResult> => {
  const generation = crawlWriteGeneration(projectId);
  return withCrawlWriteLock(projectId, () => {
    assertCrawlWriteGeneration(projectId, generation);
    return saveUnlocked(projectId, runs);
  });
};
