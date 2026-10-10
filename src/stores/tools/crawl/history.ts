import { CrawlRunRecord } from '@/types';
import { parseSiteCrawlResult } from '@/services/crawlContracts';
import { isStorageQuotaError, usesDedicatedCrawlStorage } from '@/services/crawlPersistence';
import { createId } from '@/services/ids';
import { removeStorage } from '@/services/storage';
import i18n from '@/i18n';
import type { ToolsState, ToolsSet, ToolsGet, ToolsServices } from '../contracts';
import { crawlResultKey, crawlRunsKey, activeProjectId } from '../storageKeys';
import { formatCrawlPersistenceNotice, formatCrawlRuntimeError } from '../runtime';

export const createCrawlHistoryActions = (set: ToolsSet, get: ToolsGet, services: ToolsServices): Pick<ToolsState, "importScheduledCrawlResult" | "retryCrawlPersistence"> => ({
importScheduledCrawlResult: async (result, identity) => {
    const crawlResult = parseSiteCrawlResult(result);
    if (!crawlResult) return false;
    const projectId = activeProjectId();
    if (!projectId) return false;
    const safeIdentity = identity?.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 120);
    const run: CrawlRunRecord = {
      id: safeIdentity ? `scheduled-crawl-${safeIdentity}` : createId('scheduled-crawl'),
      projectId,
      completedAt: new Date().toISOString(),
      startUrl: crawlResult.start_url,
      config: { ...get().crawlConfig, maxPages: crawlResult.pages_crawled },
      result: crawlResult,
      environment: 'default',
    };
    // The handoff identity is stable for one native execution, so it is the
    // only deduplication key we need here. Do not collapse older snapshots
    // merely because they crawled the same URL: scheduled runs must remain
    // available for trend/diff history and must not overwrite manual runs.
    const crawlRuns = [run, ...get().crawlRuns.filter((item) => item.id !== run.id)].slice(0, 50);
    try {
      const saveResult = await services.saveCrawlRuns(projectId, crawlRuns);
      const retainedRuns = crawlRuns.slice(0, crawlRuns.length - saveResult.prunedRuns);
      if (activeProjectId() !== projectId) return false;
      set({ crawlResult, crawlRuns: retainedRuns, selectedCrawlRunId: run.id, interruptedCrawl: null, crawlPersistenceError: null, crawlPersistenceNotice: formatCrawlPersistenceNotice(saveResult, retainedRuns.length), crawlPersistenceCompacted: Boolean(saveResult.compactedRuns) });
      return true;
    } catch (error) {
      if (activeProjectId() === projectId) set({ crawlResult, crawlPersistenceError: isStorageQuotaError(error) ? formatCrawlRuntimeError(error) : error instanceof Error ? error.message : i18n.t('runtimeErrors.tools.crawlHistorySaveFailed') });
      return false;
    }
  },
retryCrawlPersistence: async () => {
    const projectId = activeProjectId();
    const runs = get().crawlRuns;
    if (!projectId) {
      set({ crawlPersistenceError: i18n.t('runtimeErrors.tools.projectRequired') });
      return;
    }
    if (!runs.length) {
      set({ crawlPersistenceError: i18n.t('runtimeErrors.tools.noPendingCrawl') });
      return;
    }

    set({ isRetryingCrawlPersistence: true });
    try {
      const saveResult = await services.saveCrawlRuns(projectId, runs);
      const retainedRuns = runs.slice(0, runs.length - saveResult.prunedRuns);
      if (usesDedicatedCrawlStorage()) {
        // The dedicated store already contains the snapshot; legacy cleanup
        // is best effort and must not turn a successful retry into an error.
        removeStorage(crawlResultKey(projectId));
        removeStorage(crawlRunsKey(projectId));
      }
      if (activeProjectId() === projectId) {
        const retainedCompacted = Boolean(saveResult.compactedRuns) || Boolean(retainedRuns[0]?.storage_compacted);
        set({
          crawlRuns: retainedRuns,
          crawlPersistenceError: null,
          crawlPersistenceNotice: formatCrawlPersistenceNotice(saveResult, retainedRuns.length) || (retainedCompacted ? i18n.t('runtimeErrors.tools.boundedResave') : i18n.t('runtimeErrors.tools.historyResaved')),
          crawlPersistenceCompacted: retainedCompacted,
        });
      }
    } catch (error) {
      if (activeProjectId() === projectId) set({ crawlPersistenceError: isStorageQuotaError(error) ? formatCrawlRuntimeError(error) : error instanceof Error ? error.message : i18n.t('runtimeErrors.tools.crawlHistoryResaveFailed'), crawlPersistenceCompacted: false });
    } finally {
      if (activeProjectId() === projectId) set({ isRetryingCrawlPersistence: false });
    }
  }
});
