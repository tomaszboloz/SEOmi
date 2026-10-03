

import { isStorageQuotaError, usesDedicatedCrawlStorage } from '@/services/crawlPersistence';

import { removeStorage } from '@/services/storage';

import i18n from '@/i18n';

import type { ToolsState, ToolsSet, ToolsGet, ToolsServices } from './contracts';
import { crawlResultKey, crawlRunsKey, activeProjectId } from './storageKeys';
import { formatCrawlRuntimeError } from './runtime';

export const createCrawlHistorySlice = (set: ToolsSet, get: ToolsGet, services: ToolsServices): Pick<ToolsState, "selectCrawlRun" | "deleteCrawlRun"> => ({
selectCrawlRun: (id) => {
    const run = get().crawlRuns.find((item) => item.id === id);
    if (run) set({ crawlResult: run.result, crawlError: null, crawlExternalLinkCheckError: null, selectedCrawlRunId: id });
  },
deleteCrawlRun: async (id) => {
    if (get().isCrawling) {
      set({ crawlPersistenceError: i18n.t('runtimeErrors.tools.activeCrawlDelete') });
      return;
    }
    const projectId = activeProjectId();
    const previousRuns = get().crawlRuns;
    const run = previousRuns.find((candidate) => candidate.id === id);
    if (!projectId || !run) {
      set({ crawlPersistenceError: !projectId ? i18n.t('runtimeErrors.tools.runDeleteProject') : i18n.t('runtimeErrors.tools.runUnavailable') });
      return;
    }

    const nextRuns = previousRuns.filter((candidate) => candidate.id !== id);
    const currentRunId = get().selectedCrawlRunId
      || previousRuns.find((candidate) => candidate.result === get().crawlResult)?.id
      || previousRuns[0]?.id;
    const selectedWasDeleted = currentRunId === id;
    const nextSelectedRun = selectedWasDeleted
      ? nextRuns[0]
      : nextRuns.find((candidate) => candidate.id === get().selectedCrawlRunId);
    const previousResult = get().crawlResult;
    const previousSelectedRunId = get().selectedCrawlRunId;
    if (activeProjectId() === projectId) {
      set({
        crawlRuns: nextRuns,
        crawlResult: selectedWasDeleted ? (nextSelectedRun?.result || null) : previousResult,
        selectedCrawlRunId: selectedWasDeleted ? (nextSelectedRun?.id || null) : previousSelectedRunId,
        crawlPersistenceError: null,
        crawlPersistenceNotice: null,
      });
    }

    try {
      await services.saveCrawlRuns(projectId, nextRuns);
      if (usesDedicatedCrawlStorage()) {
        removeStorage(crawlResultKey(projectId));
        removeStorage(crawlRunsKey(projectId));
      }
      if (activeProjectId() === projectId) {
        set({ crawlPersistenceError: null, crawlPersistenceNotice: i18n.t('runtimeErrors.tools.runDeleted', { count: nextRuns.length }), crawlPersistenceCompacted: false });
      }
    } catch (error) {
      if (activeProjectId() === projectId) {
        set({
          crawlRuns: previousRuns,
          crawlResult: previousResult,
          selectedCrawlRunId: previousSelectedRunId,
          crawlPersistenceError: isStorageQuotaError(error) ? formatCrawlRuntimeError(error) : error instanceof Error ? error.message : i18n.t('runtimeErrors.tools.runDeleteFailed'),
        });
      }
    }
  }
});
