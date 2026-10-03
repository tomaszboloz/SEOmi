import type { CrawlRunRecord } from '@/types';
import { invokeTauriCommand, isTauriEnvironment } from '@/services/tauri';
import { parseCrawlRuns } from './crawlContracts';
import { indexedDbRead } from './crawlPersistence/indexedDb';
import { saveCrawlRunsUnlocked } from './crawlPersistence/native';
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

export const loadCrawlRuns = (projectId: string): Promise<CrawlRunRecord[]> => isTauriEnvironment()
  ? invokeTauriCommand<unknown>('load_project_crawl_runs', { projectId }).then(parseCrawlRuns)
  : indexedDbRead(projectId);

export const saveCrawlRuns = (projectId: string, runs: CrawlRunRecord[]): Promise<CrawlSaveResult> =>
  withCrawlWriteLock(projectId, () => saveCrawlRunsUnlocked(projectId, runs));
