import { BatchAuditItem, BatchAuditRun, AuditState } from './auditTypes';
import { activeProjectId, readHistory, writeBatchRun, readBatchRun } from './auditStorage';
import { formatQueueWakeupError, persistAuditHistory, formatAuditRuntimeError } from './auditHelpers';
import { persistNativeBatchSnapshot } from './auditNative';
import { createId } from '@/services/ids';
import i18n from '@/i18n';
import { useSettingsStore } from '@/stores/settingsStore';
import { invokeTauriCommand } from '@/services/tauri';
import { notifyBatchCompleted } from '@/services/desktopNotifications';
import { syncAuditQueueWakeup } from '@/services/scheduleWakeup';
import { writeStorage } from '@/services/storage';
import { batchQueueKey, state } from './auditConstants';
import { isStorageQuotaError } from '@/services/crawlPersistence';
import { PageAuditData } from '@/types';

type Getter = () => AuditState;
type Setter = (partial: Partial<AuditState> | ((state: AuditState) => Partial<AuditState>)) => void;

export const runBatchAudits = async (get: Getter, set: Setter): Promise<void> => {
  const projectId = activeProjectId();
  if (!projectId) return set({ error: i18n.t('runtimeErrors.tools.projectRequired') });
  if (get().isBatchRunning) return;
  let queueItems = get().batchItems.map((item) => ({ ...item }));
  const isSourceProjectActive = () => activeProjectId() === projectId;
  const persistQueue = (batchItems: BatchAuditItem[]) => {
    queueItems = batchItems;
    if (isSourceProjectActive()) set({ batchItems });
    try {
      if (!writeStorage(batchQueueKey(projectId), JSON.stringify(batchItems))) if (isSourceProjectActive()) set({ error: i18n.t('runtimeErrors.audit.queueSave') });
    } catch (error) { if (isSourceProjectActive()) set({ error: isStorageQuotaError(error) ? i18n.t('runtimeErrors.persistence.localQuota') : i18n.t('runtimeErrors.audit.queueSave') }); }
    persistNativeBatchSnapshot(projectId, batchItems, runState);
  };
  const selectedUserAgentAtStart = get().selectedUserAgent;
  const previousRun = readBatchRun(projectId) || (state.activeBatchProjectId === projectId ? get().batchRun : null);
  const run: BatchAuditRun = { id: previousRun?.id || createId('audit-run'), status: 'running', startedAt: previousRun?.startedAt || new Date().toISOString(), updatedAt: new Date().toISOString(), stopRequested: false, userAgent: previousRun?.userAgent || selectedUserAgentAtStart };
  state.activeBatchProjectId = projectId;
  set({ isBatchRunning: true, isBatchStopping: false, error: null, batchRun: run });
  writeBatchRun(projectId, run);
  persistNativeBatchSnapshot(projectId, queueItems, run);
  const isCurrentSourceRun = () => isSourceProjectActive() && state.activeBatchProjectId === projectId && get().batchRun?.id === run.id;
  const sourceStopRequested = () => {
    const persisted = readBatchRun(projectId)?.stopRequested === true;
    if (!isSourceProjectActive() || !isCurrentSourceRun()) return persisted;
    return persisted || get().isBatchStopping || Boolean(get().batchRun?.stopRequested);
  };
  void syncAuditQueueWakeup(projectId, run.id, true).then(() => { if (isCurrentSourceRun()) set({ batchWakeupError: null }); }).catch((err) => { if (isCurrentSourceRun()) set({ batchWakeupError: formatQueueWakeupError(err) }); });
  let [completedCount, failedCount, regressionCount] = [0, 0, 0];
  let runState = run;
  const persistRun = (patch: Partial<BatchAuditRun>) => {
    runState = { ...runState, ...patch, updatedAt: new Date().toISOString() };
    if (isCurrentSourceRun()) set({ batchRun: runState });
    writeBatchRun(projectId, runState);
    persistNativeBatchSnapshot(projectId, queueItems, runState);
  };
  for (const item of queueItems) {
    if (sourceStopRequested()) break;
    if (item.status !== 'queued' && item.status !== 'failed' && item.status !== 'interrupted') continue;
    persistRun({ activeItemId: item.id, lastError: undefined, stopRequested: false });
    persistQueue(queueItems.map((c) => c.id === item.id ? { ...c, status: 'running', attempts: (c.attempts || 0) + 1, updatedAt: new Date().toISOString(), error: undefined } : c));
    try {
      const requestId = createId('audit');
      if (isCurrentSourceRun()) set({ activeBatchRequestId: requestId });
      if (sourceStopRequested()) void invokeTauriCommand('cancel_inspect_url', { requestId }).catch(() => undefined);
      const data = await invokeTauriCommand<PageAuditData>('inspect_url', { url: item.url, userAgent: run.userAgent || selectedUserAgentAtStart || useSettingsStore.getState().config.default_user_agent, requestId, timeoutSecs: useSettingsStore.getState().config.request_timeout_secs, maxRedirects: useSettingsStore.getState().config.max_redirects, verifySsl: useSettingsStore.getState().config.verify_ssl });
      const sourceHistory = readHistory(projectId);
      const previousAudit = sourceHistory.find((c) => c.final_url === data.final_url || c.url === item.url);
      const history = [data, ...sourceHistory.filter((c) => c.final_url !== data.final_url)].slice(0, 25);
      try { if (!persistAuditHistory(projectId, history).saved) if (isSourceProjectActive()) set({ error: i18n.t('runtimeErrors.audit.historySave') }); } catch (storageError) { if (isSourceProjectActive()) set({ error: storageError instanceof Error ? storageError.message : i18n.t('runtimeErrors.audit.historySave') }); }
      if (isCurrentSourceRun()) set({ currentAudit: data, history });
      completedCount++;
      if (typeof previousAudit?.health_score === 'number' && data.health_score < previousAudit.health_score) regressionCount++;
      persistQueue(queueItems.map((c) => c.id === item.id ? { ...c, status: 'completed', completedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), error: undefined } : c));
      persistRun({ activeItemId: undefined });
    } catch (error) {
      const wasStopped = sourceStopRequested();
      if (!wasStopped) failedCount++;
      persistQueue(queueItems.map((c) => c.id === item.id ? { ...c, status: wasStopped ? 'queued' : 'failed', updatedAt: new Date().toISOString(), error: wasStopped ? i18n.t('runtimeErrors.audit.batchStopped') : formatAuditRuntimeError(error) } : c));
      persistRun({ activeItemId: undefined, lastError: wasStopped ? undefined : formatAuditRuntimeError(error) });
    }
  }
  const remaining = queueItems.some((i) => i.status === 'queued' || i.status === 'running' || i.status === 'interrupted' || i.status === 'failed');
  const stopped = sourceStopRequested();
  persistRun({ status: stopped || remaining ? 'stopped' : 'completed', activeItemId: undefined, stopRequested: false });
  const queuedCount = queueItems.filter((i) => i.status === 'queued' || i.status === 'interrupted' || i.status === 'running').length;
  void notifyBatchCompleted(projectId, { completed: completedCount, failed: failedCount, queued: queuedCount, regressionCount, stopped: stopped || queuedCount > 0 });
  void syncAuditQueueWakeup(projectId, runState.id, false).catch((error) => { if (activeProjectId() === projectId && get().batchRun?.id === runState.id) set({ batchWakeupError: formatQueueWakeupError(error) }); });
  if (isCurrentSourceRun()) set({ isBatchRunning: false, isBatchStopping: false, activeBatchRequestId: null });
  if (state.activeBatchProjectId === projectId) state.activeBatchProjectId = null;
};
