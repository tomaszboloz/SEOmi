import type { CrawlRunRecord } from '@/types';
import i18n from '@/i18n';
import type { CrawlSaveResult } from './contracts';
import { clearLegacyCrawlResult, clearLegacyCrawlStorage } from './legacy';
import { crawlQuotaRetryCounts, isStorageQuotaError } from './quota';
import { compactCrawlRunsForStorage } from './compaction';
import { compactCrawlRunsToPageIndex } from './pageIndex';
import { encodeCrawlRunsForStorage } from './codec';
import { indexedDbWriteOnce } from './indexedDb';
export const indexedDbWrite = async (projectId: string, runs: CrawlRunRecord[]): Promise<CrawlSaveResult> => {
  const boundedRuns = runs.slice(0, 50);
  const dedicatedSave = (result: CrawlSaveResult): CrawlSaveResult => {
    // Once the dedicated store has accepted the snapshot, remove obsolete
    // Web Storage mirrors so they cannot consume quota on later workflows.
    // When IndexedDB is unavailable, crawl_runs is the active fallback store
    // and must remain intact; only the obsolete result mirror is removable.
    if (typeof indexedDB !== 'undefined') clearLegacyCrawlStorage(projectId);
    else clearLegacyCrawlResult(projectId);
    return result;
  };
  // The result mirror is never read by the dedicated history loader and can
  // be a large stale JSON value. Remove it before compression so it cannot
  // consume the quota needed to persist the authoritative run list.
  clearLegacyCrawlResult(projectId);
  // A crawl can contain thousands of repeated URL, header, and link strings.
  // Compress the snapshot before IndexedDB persistence so WebView quota is not
  // consumed by the same verbose JSON data that the UI can regenerate in memory.
  try {
    // Encoding itself can exhaust the WebView's available memory/storage quota
    // on large histories. Keep it inside the recovery boundary so we can retry
    // after dropping older crawl runs instead of leaking the raw DOMException.
    const encodedRuns = await encodeCrawlRunsForStorage(boundedRuns);
    await indexedDbWriteOnce(projectId, boundedRuns, encodedRuns);
    return dedicatedSave({ prunedRuns: 0 });
  } catch (error) {
    if (!isStorageQuotaError(error)) throw error;
    clearLegacyCrawlStorage(projectId);
  }

  // A full WebView quota should not make a completed crawl look like a failed
  // crawl. Retry with the newest run(s), discarding only the oldest history.
  for (const retainedCount of crawlQuotaRetryCounts(boundedRuns.length)) {
    try {
      const reducedRuns = boundedRuns.slice(0, retainedCount);
      await indexedDbWriteOnce(projectId, reducedRuns, await encodeCrawlRunsForStorage(reducedRuns));
      return dedicatedSave({ prunedRuns: boundedRuns.length - retainedCount });
    } catch (error) {
      if (!isStorageQuotaError(error)) throw error;
    }
  }

  // A single, very large run can exceed the WebView quota even after older
  // history has been removed. Persist a clearly marked bounded snapshot as a
  // final recovery path instead of reporting that the crawl itself failed.
  for (const level of [1, 2, 3] as const) {
    try {
      const compactedRuns = compactCrawlRunsForStorage(boundedRuns.slice(0, 1), level);
      await indexedDbWriteOnce(projectId, compactedRuns, await encodeCrawlRunsForStorage(compactedRuns));
      return dedicatedSave({ prunedRuns: boundedRuns.length - 1, compactedRuns: 1 });
    } catch (error) {
      if (!isStorageQuotaError(error)) throw error;
    }
  }

  // A final page-index snapshot is intentionally tiny and can recover from
  // very small browser quotas where evidence compaction still fails.
  try {
    const pageIndex = compactCrawlRunsToPageIndex(boundedRuns);
    await indexedDbWriteOnce(projectId, pageIndex, await encodeCrawlRunsForStorage(pageIndex));
    return dedicatedSave({ prunedRuns: boundedRuns.length - 1, compactedRuns: 1 });
  } catch (error) {
    if (!isStorageQuotaError(error)) throw error;
    clearLegacyCrawlStorage(projectId);
  }

  throw new Error(i18n.t('runtimeErrors.persistence.localQuota'));
};
