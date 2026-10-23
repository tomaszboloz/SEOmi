import type { CrawlRunRecord } from '@/types';
import { isTauriEnvironment } from '@/services/tauri';
import { indexedDbWrite } from './crawlPersistence/browser';
import { indexedDbRead } from './crawlPersistence/indexedDb';
import { clearLegacyCrawlStorage } from './crawlPersistence/legacy';
import { loadStoredRuns, migrateLegacyCrawlRuns, saveStoredRuns } from './crawlStore';
import { withCrawlWriteLock } from './crawlPersistence/writeLock';
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
  await migrateLegacyCrawlRuns(projectId);
  return loadStoredRuns(projectId);
};

const saveUnlocked = async (projectId: string, runs: CrawlRunRecord[]): Promise<CrawlSaveResult> => {
  if (!isTauriEnvironment()) return indexedDbWrite(projectId, runs);
  await saveStoredRuns(projectId, runs);
  clearLegacyCrawlStorage(projectId);
  return { prunedRuns: Math.max(0, runs.length - 50) };
};

export const saveCrawlRuns = (projectId: string, runs: CrawlRunRecord[]): Promise<CrawlSaveResult> =>
  withCrawlWriteLock(projectId, () => saveUnlocked(projectId, runs));
