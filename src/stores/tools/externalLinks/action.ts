import type { ExternalLinkCheckBatchResult, ExternalLinkCheckProgress } from '@/types';
import { isStorageQuotaError } from '@/services/crawlPersistence';
import i18n from '@/i18n';
import type { ToolsState, ToolsSet, ToolsGet, ToolsServices } from '../contracts';
import { activeProjectId } from '../storageKeys';
import { beginToolRequest, formatCrawlRuntimeError } from '../runtime';
import { collectExternalLinkTargets } from './evidence';
import { boundedExternalLinkLimit, isCurrentExternalLinkCheck } from './session';
import { persistExternalLinkEvidence } from './persistence';

export const createExternalLinksSlice = (set: ToolsSet, get: ToolsGet, services: ToolsServices): Pick<ToolsState, 'checkCrawlExternalLinks'> => ({
checkCrawlExternalLinks: async (runId, maxUrls, force = false) => {
    const projectId = activeProjectId();
    const sourceRuns = get().crawlRuns;
    const run = sourceRuns.find((candidate) => candidate.id === runId);
    if (!projectId || !run) {
      set({ crawlExternalLinkCheckError: i18n.t('runtimeErrors.tools.runRequired') });
      return;
    }
    if (get().isCheckingCrawlExternalLinks) return;

    const uncheckedUrls = collectExternalLinkTargets(run, force);
    if (!uncheckedUrls.length) {
      set({ crawlExternalLinkCheckError: i18n.t('runtimeErrors.tools.externalCheckNoNew') });
      return;
    }

    const requestId = beginToolRequest(`external-links:${projectId}`);
    const maxCount = boundedExternalLinkLimit(maxUrls);
    const isCurrentExternalCheck = () => isCurrentExternalLinkCheck(projectId, requestId, get);
    let unlisten: (() => void) | undefined;
    set({
      isCheckingCrawlExternalLinks: true,
      crawlExternalLinkCheckProgress: { requestId, completed: 0, total: Math.min(uncheckedUrls.length, maxCount), currentUrl: '' },
      crawlExternalLinkCheckError: null,
    });
    try {
      if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
        const { listen } = await import('@tauri-apps/api/event');
        unlisten = await listen<ExternalLinkCheckProgress>('crawl-external-link-progress', (event) => {
          if (event.payload.requestId !== requestId) return;
          if (isCurrentExternalCheck()) set({ crawlExternalLinkCheckProgress: event.payload });
        });
      }
      const batch = await services.invoke<ExternalLinkCheckBatchResult>('check_external_crawl_links', {
        requestId,
        urls: uncheckedUrls,
        maxUrls: maxCount,
      });
      await persistExternalLinkEvidence({ projectId, runId, requestId, batch, force, set, get, services });
    } catch (error) {
      const quotaError = isStorageQuotaError(error);
      const message = formatCrawlRuntimeError(error);
      if (isCurrentExternalCheck()) set({
        crawlExternalLinkCheckError: message,
        ...(quotaError ? { crawlPersistenceError: message } : {}),
      });
    } finally {
      unlisten?.();
      if (isCurrentExternalCheck()) set({ isCheckingCrawlExternalLinks: false, crawlExternalLinkCheckProgress: null });
    }
  }
});
