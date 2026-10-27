import { MAX_CRAWL_LIMIT } from "@/constants/crawlLimits";
import { SiteCrawlResult, CrawlConfig, CrawlProgress, CrawlRunRecord } from '@/types';
import { isStorageQuotaError, usesDedicatedCrawlStorage } from '@/services/crawlPersistence';
import { createId } from '@/services/ids';
import { removeStorage } from '@/services/storage';
import { useSettingsStore } from '../../settingsStore';
import i18n from '@/i18n';
import type { ToolsState, InterruptedCrawl, ToolsSet, ToolsGet, ToolsServices } from '../contracts';
import { crawlResultKey, crawlRunsKey, activeProjectId } from '../storageKeys';
import { formatCrawlPersistenceNotice, formatCrawlRuntimeError } from '../runtime';
import { activeCrawlRuns, persistInterruptedCrawl, buildCrawlCheckpoint, mergeCrawlResults } from '../crawlPersistence';
import { monitorAioCrawls, monitorCrawlComparison } from '@/services/monitoringAlerts';
import { runScheduledFocus } from '@/services/siteFocusMonitoring';
import { runTaskVerification } from '@/services/optimizationTasks/runVerification';
import { compareCrawlRuns } from '@/services/crawlDiff';
import { deniedMessage, enforcePermission } from '@/services/team/enforce';
import { createLiveCrawlEventHook } from './executionHook';

export const createCrawlExecutionActions = (set: ToolsSet, get: ToolsGet, services: ToolsServices): Pick<ToolsState, "startSiteCrawl"> => ({
startSiteCrawl: async (url, limit, configPatch, environment = 'default', notifyCompletion = true, resumeBaseResult) => {
    const targetUrl = (url ?? get().crawlUrl).trim();
    const maxLimit = limit ?? get().crawlLimit;
    if (!targetUrl) return null;
    if (!enforcePermission('run_crawl', { startUrl: targetUrl })) {
      set({ crawlError: deniedMessage() });
      return null;
    }
    const projectIdAtStart = activeProjectId();
    const originalCrawlRuns = get().crawlRuns;
    const previousRun = projectIdAtStart
      ? get().crawlRuns.find((run) => run.startUrl === targetUrl)
      : undefined;

    const effectiveCrawlConfig: CrawlConfig = {
      ...get().crawlConfig,
      ...(configPatch || {}),
      maxPages: maxLimit,
    };
    const appConfig = useSettingsStore.getState().config;
    effectiveCrawlConfig.maxRedirects = effectiveCrawlConfig.maxRedirects ?? appConfig.max_redirects;
    effectiveCrawlConfig.userAgent = effectiveCrawlConfig.userAgent?.trim() || appConfig.default_user_agent;
    effectiveCrawlConfig.requestTimeoutSecs = appConfig.request_timeout_secs;
    effectiveCrawlConfig.verifySsl = appConfig.verify_ssl;
    const persistedCrawlConfig: CrawlConfig = {
      ...effectiveCrawlConfig,
      resumeCompletedUrls: undefined,
      resumeFrontierUrls: undefined,
    };
    const interruptedCrawl: InterruptedCrawl = {
      url: targetUrl,
      limit: Math.max(1, Math.min(MAX_CRAWL_LIMIT, Math.floor(maxLimit))),
      config: persistedCrawlConfig,
      environment,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const runId = createId('crawl');
    const isCurrentCrawlRun = () => activeProjectId() === projectIdAtStart && get().activeCrawlRunId === runId;
    if (projectIdAtStart) activeCrawlRuns.set(projectIdAtStart, runId);
    let unlisten: (() => void) | undefined;
    if (projectIdAtStart) persistInterruptedCrawl(projectIdAtStart, interruptedCrawl);
    const liveHook = createLiveCrawlEventHook(projectIdAtStart, runId);
    liveHook?.appendStarted(targetUrl);
    set({ isCrawling: true, isCrawlPaused: false, interruptedCrawl: null, crawlProgress: 0, crawlProgressDetail: { runId, discovered: 1, completed: 0, queued: 1, cancelled: false, paused: false, elapsedMs: 0, pagesPerSecond: 0 }, activeCrawlRunId: runId, crawlError: null, crawlPersistenceError: null, crawlPersistenceNotice: null, crawlPersistenceCompacted: false, isRetryingCrawlPersistence: false });
    try {
      if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
        const { listen } = await import('@tauri-apps/api/event');
        unlisten = await listen<CrawlProgress>('crawl-progress', (event) => {
          const progress = event.payload;
          if (progress.runId !== runId) return;
          liveHook?.appendProgress(progress);
          if (!isCurrentCrawlRun()) return;
          const known = Math.max(progress.discovered, 1);
          set({ crawlProgressDetail: progress, crawlProgress: Math.floor((progress.completed / known) * 100) });
        });
      }
      const freshCrawlResult = await services.invoke<SiteCrawlResult>('crawl_site', { startUrl: targetUrl, maxPages: maxLimit, runId, projectId: projectIdAtStart || undefined, config: effectiveCrawlConfig });
      if (!freshCrawlResult.pages.length && !freshCrawlResult.cancelled && !resumeBaseResult) throw new Error(i18n.t('runtimeErrors.tools.crawlerNoPages'));
      liveHook?.appendPages(freshCrawlResult.pages);
      const crawlResult = resumeBaseResult ? mergeCrawlResults(resumeBaseResult, freshCrawlResult) : freshCrawlResult;
      const run: CrawlRunRecord = { id: runId, projectId: projectIdAtStart || undefined, completedAt: new Date().toISOString(), startUrl: targetUrl, config: persistedCrawlConfig, result: crawlResult, environment };
      if (freshCrawlResult.cancelled) {
        await liveHook?.appendCancelled(crawlResult.pages.length, targetUrl);
      } else {
        await liveHook?.appendCompleted(crawlResult.pages.length, run.completedAt, targetUrl);
      }
      const baseId = interruptedCrawl?.baseRunId;
      const projectRuns = activeProjectId() === projectIdAtStart ? get().crawlRuns : originalCrawlRuns;
      const crawlRuns = [run, ...projectRuns.filter((item) => item.id !== run.id && (!baseId || item.id !== baseId) && Boolean(item.completedAt))].slice(0, 50);
      const projectId = projectIdAtStart;
      const canResume = Boolean(freshCrawlResult.cancelled || freshCrawlResult.timed_out);
      const pendingCrawl = canResume ? { ...interruptedCrawl, ...buildCrawlCheckpoint(crawlResult), baseRunId: runId } : null;
      if (projectId && activeCrawlRuns.get(projectId) === runId) persistInterruptedCrawl(projectId, pendingCrawl);
      if (isCurrentCrawlRun()) {
        set({ crawlResult, crawlRuns, isCrawling: false, isCrawlPaused: false, interruptedCrawl: pendingCrawl, crawlProgress: 100, activeCrawlRunId: null, selectedCrawlRunId: runId });
      }
      if (projectId) {
        try {
          const saveResult = await services.saveCrawlRuns(projectId, crawlRuns);
          const retainedRuns = crawlRuns.slice(0, crawlRuns.length - saveResult.prunedRuns);
          if (usesDedicatedCrawlStorage()) {
            removeStorage(crawlResultKey(projectId));
            removeStorage(crawlRunsKey(projectId));
          }
          if (activeProjectId() === projectId && activeCrawlRuns.get(projectId) === runId) set({ crawlRuns: retainedRuns, crawlPersistenceError: null, crawlPersistenceNotice: formatCrawlPersistenceNotice(saveResult, retainedRuns.length), crawlPersistenceCompacted: Boolean(saveResult.compactedRuns) });
        } catch (error) {
          if (activeProjectId() === projectId && activeCrawlRuns.get(projectId) === runId) set({ crawlPersistenceError: isStorageQuotaError(error) ? formatCrawlRuntimeError(error) : error instanceof Error ? error.message : i18n.t('runtimeErrors.tools.crawlHistorySaveFailed') });
        }
      }
      if (projectId && notifyCompletion) {
        void services.notifyCrawlCompleted(projectId, crawlResult, previousRun?.result, { runId });
      }
      if (projectId && previousRun) void monitorCrawlComparison(projectId, compareCrawlRuns(run, previousRun, { projectId }));
      if (projectId) void monitorAioCrawls(projectId, run, projectRuns).catch(() => undefined);
      if (projectId) void runScheduledFocus(projectId, run, previousRun);
      if (projectId) { try { runTaskVerification(projectId, run); } catch { /* verification is best-effort */ } }
      return crawlResult;
    } catch (err: unknown) {
      const msg = formatCrawlRuntimeError(err);
      if (liveHook) {
        try { await liveHook.appendError(msg); } catch { /* preserve main runtime error */ }
      }
      if (projectIdAtStart && activeCrawlRuns.get(projectIdAtStart) === runId) persistInterruptedCrawl(projectIdAtStart, interruptedCrawl);
      if (isCurrentCrawlRun()) {
        set({ crawlError: msg, interruptedCrawl, isCrawling: false, isCrawlPaused: false, activeCrawlRunId: null });
      }
      return null;
    } finally {
      unlisten?.();
    }
  }
});
