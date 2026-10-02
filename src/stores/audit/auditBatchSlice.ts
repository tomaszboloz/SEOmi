import { StateCreator } from 'zustand';
import { AuditState } from './auditTypes';
import { activeProjectId, readHistory, writeBatchRun, readBatchRun, readBatchQueue, readDataForSeoTarget, readActiveTab, readDataForSeoSummary, readDataForSeoSerp } from './auditStorage';
import { formatQueueWakeupError, auditHostname, beginAuditRequest } from './auditHelpers';
import { persistNativeBatchSnapshot, clearNativeBatchSnapshot, hydrateNativeBatchQueue } from './auditNative';
import { createId } from '@/services/ids';
import i18n from '@/i18n';
import { invokeTauriCommand } from '@/services/tauri';
import { syncAuditQueueWakeup } from '@/services/scheduleWakeup';
import { importUrlsFromCsv } from '@/services/csvUrls';
import { writeStorage, removeStorage, readStorage } from '@/services/storage';
import { batchQueueKey, historyKey, onlyProblemsKey, state, LEGACY_HISTORY_KEY } from './auditConstants';
import { runBatchAudits } from './auditBatchRunner';

export const createAuditBatchSlice: StateCreator<AuditState, [], [], Pick<AuditState, 'importAuditCsv' | 'startBatchAudits' | 'stopBatchAudits' | 'clearBatchAudits' | 'hydrateProject'>> = (set, get) => ({
  importAuditCsv: (csv) => {
    const projectId = activeProjectId();
    if (!projectId) return set({ error: i18n.t('runtimeErrors.tools.projectRequired') });
    const imported = importUrlsFromCsv(csv);
    const existing = get().batchItems;
    const existingUrls = new Set(existing.map((item) => item.url));
    const newItems = imported.urls
      .filter((url) => !existingUrls.has(url))
      .map((url) => ({ id: createId('batch-item'), url, status: 'queued' as const, updatedAt: new Date().toISOString() }));
    const batchItems = [...existing, ...newItems];
    const queueSaved = writeStorage(batchQueueKey(projectId), JSON.stringify(batchItems));
    set({
      batchItems,
      batchRejectedRows: imported.rejected,
      error: !imported.urls.length ? i18n.t('runtimeErrors.audit.csvInvalid') : queueSaved ? null : i18n.t('runtimeErrors.audit.queueSave'),
    });
    persistNativeBatchSnapshot(projectId, batchItems, get().batchRun);
  },
  startBatchAudits: () => runBatchAudits(get, set),
  stopBatchAudits: () => {
    const requestId = get().activeBatchRequestId;
    set({ isBatchStopping: true });
    const projectId = activeProjectId();
    const currentRun = get().batchRun;
    if (projectId && currentRun) {
      const run = { ...currentRun, stopRequested: true, updatedAt: new Date().toISOString() };
      set({ batchRun: run });
      writeBatchRun(projectId, run);
      persistNativeBatchSnapshot(projectId, get().batchItems, run);
      void syncAuditQueueWakeup(projectId, currentRun.id, false).catch((err) => { if (activeProjectId() === projectId) set({ batchWakeupError: formatQueueWakeupError(err) }); });
    }
    if (requestId) void invokeTauriCommand('cancel_inspect_url', { requestId }).catch(() => undefined);
  },
  clearBatchAudits: () => {
    const projectId = activeProjectId();
    if (get().isBatchRunning) return;
    if (projectId) {
      removeStorage(batchQueueKey(projectId));
      writeBatchRun(projectId, null);
      clearNativeBatchSnapshot(projectId);
      if (get().batchRun?.id) void syncAuditQueueWakeup(projectId, get().batchRun?.id || null, false).catch((err) => { if (activeProjectId() === projectId) set({ batchWakeupError: formatQueueWakeupError(err) }); });
    }
    set({ batchItems: [], batchRun: null, batchRejectedRows: [], isBatchStopping: false, activeBatchRequestId: null, batchWakeupError: null });
  },
  hydrateProject: (projectId) => {
    beginAuditRequest('single');
    beginAuditRequest('dataforseo-summary');
    beginAuditRequest('dataforseo-serp');
    if (!projectId) return set({ currentAudit: null, history: [], isLoading: false, activeTab: 'overview', dataforseoData: null, dataforseoSerp: [], dataforseoError: null, batchItems: [], batchRun: null, batchRejectedRows: [], isBatchRunning: false, isBatchStopping: false, batchWakeupError: null, activeBatchRequestId: null, showOnlyProblems: false });
    let history = readHistory(projectId);
    const legacy = readStorage(LEGACY_HISTORY_KEY);
    if (!history.length && legacy && !readStorage('seomi_legacy_history_migrated_v1')) {
      writeStorage(historyKey(projectId), legacy);
      removeStorage(LEGACY_HISTORY_KEY);
      writeStorage('seomi_legacy_history_migrated_v1', 'true');
      history = readHistory(projectId);
    }
    let batchItems = readBatchQueue(projectId);
    let batchRun = readBatchRun(projectId);
    const hasRunningItem = batchItems.some((item) => item.status === 'running');
    if ((batchRun?.status === 'running' || hasRunningItem) && state.activeBatchProjectId !== projectId) {
      const interruptedAt = new Date().toISOString();
      batchItems = batchItems.map((item) => item.status === 'running' ? { ...item, status: 'interrupted' as const, updatedAt: interruptedAt, error: i18n.t('runtimeErrors.audit.batchInterrupted') } : item);
      batchRun = batchRun ? { ...batchRun, status: 'interrupted', updatedAt: interruptedAt, stopRequested: false } : { id: createId('batch-run'), status: 'interrupted', startedAt: interruptedAt, updatedAt: interruptedAt };
      try { writeStorage(batchQueueKey(projectId), JSON.stringify(batchItems)); } catch {}
      writeBatchRun(projectId, batchRun);
      persistNativeBatchSnapshot(projectId, batchItems, batchRun);
    }
    const hydratedAudit = history[0] || null;
    const storedTarget = readDataForSeoTarget(projectId);
    const hydratedTarget = auditHostname(hydratedAudit);
    const canRestoreLiveEvidence = Boolean(storedTarget && hydratedTarget && (storedTarget === hydratedTarget || storedTarget.replace(/^www\./, '') === hydratedTarget.replace(/^www\./, '')));
    set({ currentAudit: hydratedAudit, history, isLoading: false, activeTab: readActiveTab(projectId), dataforseoData: canRestoreLiveEvidence ? readDataForSeoSummary(projectId) : null, dataforseoSerp: canRestoreLiveEvidence ? readDataForSeoSerp(projectId) : [], dataforseoError: null, batchItems, batchRun, batchRejectedRows: [], isBatchRunning: state.activeBatchProjectId === projectId, isBatchStopping: false, batchWakeupError: null, activeBatchRequestId: null, showOnlyProblems: readStorage(onlyProblemsKey(projectId)) === 'true' });
    void hydrateNativeBatchQueue(projectId, get, set);
  },
});
