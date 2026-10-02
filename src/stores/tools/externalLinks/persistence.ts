import type { ExternalLinkCheckBatchResult } from '@/types';
import { isStorageQuotaError } from '@/services/crawlPersistence';
import i18n from '@/i18n';
import type { ToolsSet, ToolsGet, ToolsServices } from '../contracts';
import { activeProjectId } from '../storageKeys';
import { formatCrawlPersistenceNotice, formatCrawlRuntimeError, isLatestToolRequest } from '../runtime';
import { applyExternalLinkEvidence } from './evidence';
import { isCurrentExternalLinkCheck } from './session';

interface ExternalLinkPersistenceContext {
  projectId: string;
  runId: string;
  requestId: string;
  batch: ExternalLinkCheckBatchResult;
  force: boolean;
  set: ToolsSet;
  get: ToolsGet;
  services: ToolsServices;
}

export const persistExternalLinkEvidence = async (context: ExternalLinkPersistenceContext): Promise<void> => {
  const { projectId, runId, requestId, batch, force, set, get, services } = context;
  const isCurrent = () => isCurrentExternalLinkCheck(projectId, requestId, get);
  const isLatest = () => isLatestToolRequest(`external-links:${projectId}`, requestId);
  // Superseded checks may not replace newer evidence in the same project.
  // Background checks can still persist to their originating project.
  if (!isLatest() || (activeProjectId() === projectId && !isCurrent())) return;
  const loadedRuns = activeProjectId() === projectId ? get().crawlRuns : await services.loadCrawlRuns(projectId);
  if (!isLatest() || (activeProjectId() === projectId && !isCurrent())) return;
  const latestRuns = activeProjectId() === projectId ? get().crawlRuns : loadedRuns;
  const latestRun = latestRuns.find(candidate => candidate.id === runId);
  if (!latestRun) {
    if (isCurrent()) set({ crawlExternalLinkCheckError: i18n.t('runtimeErrors.tools.runUnavailable') });
    return;
  } else {
    const result = applyExternalLinkEvidence(latestRun.result, batch, force);
    const crawlRuns = latestRuns.map(candidate => candidate.id === runId ? { ...candidate, result } : candidate);
    // Publish checked evidence before persistence so subsequent history edits
    // build on it. The array identity identifies this exact history revision;
    // a delayed save cannot restore a deleted run or replace a newer revision.
    const visibleRuns = isCurrent() ? crawlRuns : null;
    if (visibleRuns) set({ crawlRuns: visibleRuns,
      ...(get().selectedCrawlRunId === runId ? { crawlResult: result } : {}) });
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
    } catch (error) {
      persistenceError = isStorageQuotaError(error) ? formatCrawlRuntimeError(error)
        : error instanceof Error ? error.message : i18n.t('runtimeErrors.tools.externalCheckSaveFailed');
    }
    if (!isLatest() || !isCurrent() || get().crawlRuns !== visibleRuns) return;
    const selectedResult = persistedRuns.find(candidate => candidate.id === get().selectedCrawlRunId)?.result;
    set({
      crawlRuns: persistedRuns,
      crawlPersistenceError: persistenceError,
      crawlPersistenceNotice: saveNotice,
      crawlPersistenceCompacted: persistenceCompacted,
      ...(selectedResult ? { crawlResult: selectedResult } : {}),
      crawlExternalLinkCheckError: batch.omitted > 0
        ? i18n.t('runtimeErrors.tools.externalCheckSummary', { checked: batch.checked, requested: batch.requested, omitted: batch.omitted })
        : null,
    });
  }
};
