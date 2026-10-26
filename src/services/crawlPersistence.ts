import type { CrawlRunRecord } from '@/types';
import { isTauriEnvironment } from '@/services/tauri';
import { indexedDbWrite } from './crawlPersistence/browser';
import { indexedDbRead } from './crawlPersistence/indexedDb';
import { clearLegacyCrawlStorage } from './crawlPersistence/legacy';
import { loadStoredRuns, migrateLegacyCrawlRuns, saveStoredRuns } from './crawlStore';
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
    return loadStoredRuns(projectId);
  });
};

const saveUnlocked = async (projectId: string, runs: CrawlRunRecord[]): Promise<CrawlSaveResult> => {
  if (!isTauriEnvironment()) return indexedDbWrite(projectId, runs);
  // A save can be the first action after restoring a backup or a failed load.
  // Finish migration before replacement or legacy cleanup can discard v1 data.
  await migrateLegacyCrawlRuns(projectId);
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
