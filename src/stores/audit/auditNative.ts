import { AuditState, BatchAuditItem, BatchAuditRun } from './auditTypes';
import { PageAuditData } from '@/types';
import {
  saveNativeAuditQueue,
  loadNativeAuditQueueResults,
  acknowledgeNativeAuditQueueResult,
  loadNativeAuditQueueExecutions,
  acknowledgeNativeAuditQueueExecution,
  deleteNativeAuditQueue,
  loadNativeAuditQueue,
} from '@/services/auditQueuePersistence';
import { nativeQueueWrites, state, batchQueueKey } from './auditConstants';
import { activeProjectId, readHistory, writeBatchRun } from './auditStorage';
import { persistAuditHistory, recoverInterruptedBatch, parseBatchQueue, parseBatchRun, batchSnapshotFingerprint } from './auditHelpers';
import { writeStorage } from '@/services/storage';

export const persistNativeBatchSnapshot = (projectId: string, items: BatchAuditItem[], run: BatchAuditRun | null): void => {
  const snapshot = { items: items.slice(0, 50_000), run };
  const previous = nativeQueueWrites.get(projectId) || Promise.resolve(true);
  const next = previous.then(() => saveNativeAuditQueue(projectId, snapshot));
  nativeQueueWrites.set(projectId, next);
  void next.then(() => {
    if (nativeQueueWrites.get(projectId) === next) nativeQueueWrites.delete(projectId);
  });
};

export const reconcileNativeBatchResults = async (
  projectId: string,
  readState: () => Pick<AuditState, 'batchItems' | 'batchRun' | 'isBatchRunning'>,
  setState: (patch: Partial<AuditState>) => void,
): Promise<void> => {
  const nativeResults = await loadNativeAuditQueueResults(projectId);
  if (activeProjectId() !== projectId || readState().isBatchRunning) return;
  const recoveredAudits = nativeResults
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const candidate = entry as { runId?: unknown; itemId?: unknown; audit?: unknown };
      if (typeof candidate.runId !== 'string' || typeof candidate.itemId !== 'string' || !candidate.audit || typeof candidate.audit !== 'object') return null;
      const audit = candidate.audit as Partial<PageAuditData>;
      if (typeof audit.url !== 'string' || typeof audit.timestamp !== 'string') return null;
      return { runId: candidate.runId, itemId: candidate.itemId, audit: candidate.audit as PageAuditData };
    })
    .filter((entry): entry is { runId: string; itemId: string; audit: PageAuditData } => Boolean(entry));
  if (recoveredAudits.length) {
    const currentHistory = readHistory(projectId);
    const mergedHistory = recoveredAudits.reduce<PageAuditData[]>((history, entry) => [
      entry.audit,
      ...history.filter((item) => item.timestamp !== entry.audit.timestamp && item.final_url !== entry.audit.final_url),
    ], currentHistory).slice(0, 25);
    if (persistAuditHistory(projectId, mergedHistory).saved) {
      setState({ history: mergedHistory, currentAudit: mergedHistory[0] || null });
      for (const entry of recoveredAudits) {
        await acknowledgeNativeAuditQueueResult(projectId, entry.runId, entry.itemId).catch(() => undefined);
      }
    }
  }
  const nativeExecutions = await loadNativeAuditQueueExecutions(projectId);
  for (const execution of nativeExecutions) {
    if (!execution || typeof execution !== 'object') continue;
    const runId = (execution as { runId?: unknown }).runId;
    if (typeof runId === 'string') {
      await acknowledgeNativeAuditQueueExecution(projectId, runId).catch(() => undefined);
    }
  }
};

export const clearNativeBatchSnapshot = (projectId: string): void => {
  const previous = nativeQueueWrites.get(projectId) || Promise.resolve(true);
  const next = previous.then(() => deleteNativeAuditQueue(projectId));
  nativeQueueWrites.set(projectId, next);
  void next.then(() => {
    if (nativeQueueWrites.get(projectId) === next) nativeQueueWrites.delete(projectId);
  });
};

export const hydrateNativeBatchQueue = async (
  projectId: string,
  readState: () => Pick<AuditState, 'batchItems' | 'batchRun' | 'isBatchRunning'>,
  setState: (patch: Partial<AuditState>) => void,
): Promise<void> => {
  const initial = readState();
  const initialFingerprint = batchSnapshotFingerprint(initial.batchItems, initial.batchRun);
  const loaded = await loadNativeAuditQueue(projectId);
  if (!loaded.available || activeProjectId() !== projectId) return;

  const current = readState();
  if (current.isBatchRunning || state.activeBatchProjectId === projectId) return;
  
  if (batchSnapshotFingerprint(current.batchItems, current.batchRun) !== initialFingerprint) {
    persistNativeBatchSnapshot(projectId, current.batchItems, current.batchRun);
    return;
  }

  if (loaded.snapshot === null) {
    persistNativeBatchSnapshot(projectId, current.batchItems, current.batchRun);
    await reconcileNativeBatchResults(projectId, readState, setState);
    return;
  }
  if (!loaded.snapshot || typeof loaded.snapshot !== 'object') return;
  const candidate = loaded.snapshot as { items?: unknown; run?: unknown };
  if (!Array.isArray(candidate.items)) return;
  const nativeRun = candidate.run === null || candidate.run === undefined ? null : parseBatchRun(candidate.run);
  if (candidate.run !== null && candidate.run !== undefined && !nativeRun) return;
  const recovered = recoverInterruptedBatch(parseBatchQueue(candidate.items), nativeRun);
  if (activeProjectId() !== projectId || readState().isBatchRunning) return;
  setState({ batchItems: recovered.items, batchRun: recovered.run });
  writeStorage(batchQueueKey(projectId), JSON.stringify(recovered.items));
  writeBatchRun(projectId, recovered.run);
  persistNativeBatchSnapshot(projectId, recovered.items, recovered.run);
  await reconcileNativeBatchResults(projectId, readState, setState);
};
