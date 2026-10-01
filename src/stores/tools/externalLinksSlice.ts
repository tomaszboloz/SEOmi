
import { ExternalLinkCheckBatchResult, ExternalLinkCheckProgress } from '@/types';

import { isStorageQuotaError } from '@/services/crawlPersistence';

import { createId } from '@/services/ids';

import i18n from '@/i18n';

import type { ToolsState, ToolsSet, ToolsGet, ToolsServices } from './contracts';
import { activeProjectId } from './storageKeys';
import { formatCrawlPersistenceNotice, formatCrawlRuntimeError } from './runtime';

import { normalizeCrawlLinkUrl } from './crawlPersistence';

export const createExternalLinksSlice = (set: ToolsSet, get: ToolsGet, services: ToolsServices): Pick<ToolsState, "checkCrawlExternalLinks"> => ({
checkCrawlExternalLinks: async (runId, maxUrls, force = false) => {
    const projectId = activeProjectId();
    const sourceRuns = get().crawlRuns;
    const run = sourceRuns.find((candidate) => candidate.id === runId);
    if (!projectId || !run) {
      set({ crawlExternalLinkCheckError: i18n.t('runtimeErrors.tools.runRequired') });
      return;
    }
    if (get().isCheckingCrawlExternalLinks) return;

    const uncheckedUrls = [...new Set(run.result.pages.flatMap((page) => page.links
      .filter((link) => !link.is_internal && (force || !link.target_checked_at))
      .map((link) => normalizeCrawlLinkUrl(link.target_url))))];
    if (!uncheckedUrls.length) {
      set({ crawlExternalLinkCheckError: i18n.t('runtimeErrors.tools.externalCheckNoNew') });
      return;
    }

    const requestId = createId('external-links');
    const maxCount = Math.min(Math.max(Math.floor(maxUrls), 1), 1_000);
    const isCurrentExternalCheck = () => activeProjectId() === projectId && get().crawlExternalLinkCheckProgress?.requestId === requestId;
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
      // Continue persisting to the originating project if the request
      // completed after navigation, but never let stale results mutate the
      // newly selected project's visible state.
      // Resolve the originating run again before applying a delayed response.
      // The user can delete a run or select another one while the external
      // requests are in flight. Never resurrect a deleted run from the stale
      // snapshot captured when the request started.
      const activeProjectAtResolution = activeProjectId();
      const latestRuns = activeProjectAtResolution === projectId
        ? get().crawlRuns
        : await services.loadCrawlRuns(projectId);
      const latestRun = latestRuns.find((candidate) => candidate.id === runId);
      if (!latestRun) {
        if (activeProjectAtResolution === projectId) {
          set({ crawlExternalLinkCheckError: i18n.t('runtimeErrors.tools.runUnavailable') });
        }
        return;
      }
      const selectedRunIdAtResolution = isCurrentExternalCheck()
        ? get().selectedCrawlRunId
        : null;
      const byUrl = new Map(batch.results.map((item) => [normalizeCrawlLinkUrl(item.url), item]));
      const checkedAtFallback = new Date().toISOString();
      const pages = latestRun.result.pages.map((page) => {
        const links = page.links.map((link) => {
          if (link.is_internal || (!force && link.target_checked_at)) return link;
          const check = byUrl.get(normalizeCrawlLinkUrl(link.target_url));
          if (!check) return link;
          return {
            ...link,
            target_http_status: check.httpStatus,
            target_response_time_ms: check.responseTimeMs,
            target_redirect_url: check.redirectUrl,
            target_request_error_kind: check.requestErrorKind,
            target_checked_at: check.checkedAt || checkedAtFallback,
          };
        });
        const existing = page.issues.filter((issue) => issue.code !== 'external-link-check');
        const failedTargets = new Set(links.filter((link) => !link.is_internal && (
          (link.target_http_status !== undefined && link.target_http_status >= 400)
          || ['dns', 'timeout', 'tls', 'connect', 'network'].includes(link.target_request_error_kind || '')
        )).map((link) => normalizeCrawlLinkUrl(link.target_url)));
        if (failedTargets.size) existing.push({
          severity: 'Warning',
          code: 'external-link-check',
          message: i18n.t('crawl.ui.externalLinkIssue', { count: failedTargets.size }),
        });
        return { ...page, links, issues: existing, issues_count: existing.length };
      });
      const criticalCount = pages.reduce((count, page) => count + page.issues.filter((issue) => issue.severity === 'Critical').length, 0);
      const warningCount = pages.reduce((count, page) => count + page.issues.filter((issue) => issue.severity === 'Warning').length, 0);
      const noticeCount = pages.reduce((count, page) => count + page.issues.filter((issue) => issue.severity === 'Info').length, 0);
      const healthScore = Math.max(20, 100 - Math.min(80, criticalCount * 15 + warningCount * 5));
      const result = { ...latestRun.result, pages, critical_count: criticalCount, warning_count: warningCount, notice_count: noticeCount, health_score: healthScore };
      const crawlRuns = latestRuns.map((candidate) => candidate.id === runId ? { ...candidate, result } : candidate);
      let persistenceError: string | null = null;
      let saveNotice: string | null = null;
      let persistenceCompacted = false;
      let persistedRuns = crawlRuns;
      try {
        const saveResult = await services.saveCrawlRuns(projectId, crawlRuns);
        persistedRuns = crawlRuns.slice(0, crawlRuns.length - saveResult.prunedRuns);
        saveNotice = formatCrawlPersistenceNotice(saveResult, persistedRuns.length);
        persistenceCompacted = Boolean(saveResult.compactedRuns) || Boolean(persistedRuns[0]?.storage_compacted);
        if (persistenceCompacted && !saveNotice) saveNotice = i18n.t('runtimeErrors.tools.boundedResave');
      } catch (error) { persistenceError = isStorageQuotaError(error) ? formatCrawlRuntimeError(error) : error instanceof Error ? error.message : i18n.t('runtimeErrors.tools.externalCheckSaveFailed'); }
      const selectedResult = persistedRuns.find((candidate) => candidate.id === selectedRunIdAtResolution)?.result;
      if (isCurrentExternalCheck()) {
        set({
          crawlRuns: persistedRuns,
          crawlPersistenceError: persistenceError,
          crawlPersistenceNotice: saveNotice,
          crawlPersistenceCompacted: persistenceCompacted,
          ...(selectedResult ? { crawlResult: selectedResult } : {}),
          ...(selectedRunIdAtResolution === runId ? { crawlResult: result } : {}),
          crawlExternalLinkCheckError: batch.omitted > 0
            ? i18n.t('runtimeErrors.tools.externalCheckSummary', { checked: batch.checked, requested: batch.requested, omitted: batch.omitted })
            : null,
        });
      }
    } catch (error) {
      const quotaError = isStorageQuotaError(error);
      const message = formatCrawlRuntimeError(error);
      if (activeProjectId() === projectId) set({
        crawlExternalLinkCheckError: message,
        ...(quotaError ? { crawlPersistenceError: message } : {}),
      });
    } finally {
      unlisten?.();
      if (isCurrentExternalCheck()) set({ isCheckingCrawlExternalLinks: false, crawlExternalLinkCheckProgress: null });
    }
  }
});
