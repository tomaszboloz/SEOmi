import { removeStorage } from '@/services/storage';
/**
 * Older builds mirrored crawl history/result in Web Storage. Once IndexedDB
 * or the native project store is active those copies are obsolete, but a full
 * legacy JSON value can still consume the quota needed for recovery. Remove
 * only these two known compatibility keys after a quota failure; never touch
 * project preferences or the dedicated crawl store.
 */
export const clearLegacyCrawlStorage = (projectId: string): void => {
  removeStorage(`seomi_project_${projectId}_crawl_result`);
  removeStorage(`seomi_project_${projectId}_crawl_runs`);
};

export const clearLegacyCrawlResult = (projectId: string): void => {
  removeStorage(`seomi_project_${projectId}_crawl_result`);
};
