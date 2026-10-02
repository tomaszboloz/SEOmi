import type { CrawlRunRecord } from '@/types';
import i18n from '@/i18n';
import type { CrawlSaveResult } from './contracts';
import { clearLegacyCrawlStorage } from './legacy';
import { crawlQuotaRetryCounts, isStorageQuotaError } from './quota';
import { compactCrawlRunsForStorage } from './compaction';
import { compactCrawlRunsToPageIndex } from './pageIndex';
import { invokeTauriCommand, isTauriEnvironment } from '@/services/tauri';
import { indexedDbWrite } from './browser';
export const saveCrawlRunsUnlocked = async (projectId: string, runs: CrawlRunRecord[]): Promise<CrawlSaveResult> => {
  if (!isTauriEnvironment()) return indexedDbWrite(projectId, runs);

  const boundedRuns = runs.slice(0, 50);
  const dedicatedSave = (result: CrawlSaveResult): CrawlSaveResult => {
    clearLegacyCrawlStorage(projectId);
    return result;
  };
  try {
    await invokeTauriCommand<void>('save_project_crawl_runs', { projectId, crawlRuns: boundedRuns });
    return dedicatedSave({ prunedRuns: 0 });
  } catch (error) {
    if (!isStorageQuotaError(error)) throw error;
    clearLegacyCrawlStorage(projectId);
  }

  // Desktop storage can also run out of space. Keep the newest crawl and retry
  // after dropping progressively more of the older project history.
  for (const retainedCount of crawlQuotaRetryCounts(boundedRuns.length)) {
    try {
      await invokeTauriCommand<void>('save_project_crawl_runs', {
        projectId,
        crawlRuns: boundedRuns.slice(0, retainedCount),
      });
      return dedicatedSave({ prunedRuns: boundedRuns.length - retainedCount });
    } catch (error) {
      if (!isStorageQuotaError(error)) throw error;
    }
  }

  for (const level of [1, 2, 3] as const) {
    try {
      const compactedRuns = compactCrawlRunsForStorage(boundedRuns.slice(0, 1), level);
      await invokeTauriCommand<void>('save_project_crawl_runs', {
        projectId,
        crawlRuns: compactedRuns,
      });
      return dedicatedSave({ prunedRuns: boundedRuns.length - 1, compactedRuns: 1 });
    } catch (error) {
      if (!isStorageQuotaError(error)) throw error;
    }
  }

  try {
    const pageIndex = compactCrawlRunsToPageIndex(boundedRuns);
    await invokeTauriCommand<void>('save_project_crawl_runs', {
      projectId,
      crawlRuns: pageIndex,
    });
    return dedicatedSave({ prunedRuns: boundedRuns.length - 1, compactedRuns: 1 });
  } catch (error) {
    if (!isStorageQuotaError(error)) throw error;
  }

  throw new Error(i18n.t('runtimeErrors.persistence.diskQuota'));
};
