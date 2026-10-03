import type { ToolsState, ToolsSet, ToolsGet, ToolsServices } from '../contracts';
import { activeProjectId } from '../storageKeys';
import { formatCrawlRuntimeError } from '../runtime';
import { persistInterruptedCrawl } from '../crawlPersistence';

export const createCrawlControlsActions = (set: ToolsSet, get: ToolsGet, services: ToolsServices): Pick<ToolsState, "cancelSiteCrawl" | "pauseSiteCrawl" | "resumeSiteCrawl" | "resumeInterruptedCrawl" | "discardInterruptedCrawl"> => ({
cancelSiteCrawl: async () => {
    const projectIdAtStart = activeProjectId();
    const runId = get().activeCrawlRunId;
    if (!runId) return;
    try {
      await services.invoke('cancel_site_crawl', { runId });
    } catch (error) {
      if (activeProjectId() === projectIdAtStart && get().activeCrawlRunId === runId) {
        set({ crawlError: formatCrawlRuntimeError(error) });
      }
    }
  },
pauseSiteCrawl: async () => {
    const projectIdAtStart = activeProjectId();
    const runId = get().activeCrawlRunId;
    if (!runId || !get().isCrawling || get().isCrawlPaused) return;
    try {
      await services.invoke('pause_site_crawl', { runId });
      if (activeProjectId() !== projectIdAtStart || get().activeCrawlRunId !== runId) return;
      const progress = get().crawlProgressDetail;
      set({ isCrawlPaused: true, crawlProgressDetail: progress ? { ...progress, paused: true } : null });
    } catch (error) {
      if (activeProjectId() === projectIdAtStart && get().activeCrawlRunId === runId) {
        set({ crawlError: formatCrawlRuntimeError(error) });
      }
    }
  },
resumeSiteCrawl: async () => {
    const projectIdAtStart = activeProjectId();
    const runId = get().activeCrawlRunId;
    if (!runId || !get().isCrawling || !get().isCrawlPaused) return;
    try {
      await services.invoke('resume_site_crawl', { runId });
      if (activeProjectId() !== projectIdAtStart || get().activeCrawlRunId !== runId) return;
      const progress = get().crawlProgressDetail;
      set({ isCrawlPaused: false, crawlProgressDetail: progress ? { ...progress, paused: false } : null });
    } catch (error) {
      if (activeProjectId() === projectIdAtStart && get().activeCrawlRunId === runId) {
        set({ crawlError: formatCrawlRuntimeError(error) });
      }
    }
  },
resumeInterruptedCrawl: async () => {
    const pending = get().interruptedCrawl;
    if (!pending || get().isCrawling) return null;
    const baseRun = pending.baseRunId ? get().crawlRuns.find((run) => run.id === pending.baseRunId) : undefined;
    const config = baseRun && pending.completedUrls?.length
      ? { ...pending.config, resumeCompletedUrls: pending.completedUrls, resumeFrontierUrls: pending.frontierUrls || [] }
      : pending.config;
    return get().startSiteCrawl(pending.url, pending.limit, config, pending.environment, true, baseRun?.result);
  },
discardInterruptedCrawl: () => {
    const projectId = activeProjectId();
    if (projectId) persistInterruptedCrawl(projectId, null);
    set({ interruptedCrawl: null });
  }
});
