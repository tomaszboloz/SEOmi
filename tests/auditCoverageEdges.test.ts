import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAuditBatchSlice } from '@/stores/audit/auditBatchSlice';
import { state, nativeQueueWrites } from '@/stores/audit/auditConstants';
import { reconcileNativeBatchResults } from '@/stores/audit/auditNative';
import { mockAudit } from './fixtures/auditStoreContracts';

const mocks = vi.hoisted(() => ({ wakeup: vi.fn(), invoke: vi.fn(), save: vi.fn(), results: vi.fn(), ackResult: vi.fn(), executions: vi.fn(), ackExecution: vi.fn(), remove: vi.fn() }));
vi.mock('@/services/scheduleWakeup', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/services/scheduleWakeup')>()), syncAuditQueueWakeup: mocks.wakeup }));
vi.mock('@/services/tauri', () => ({ invokeTauriCommand: mocks.invoke, isTauriEnvironment: vi.fn(() => false) }));
vi.mock('@/services/desktopNotifications', () => ({ notifyAuditCompleted: vi.fn(), notifyBatchCompleted: vi.fn() }));
vi.mock('@/services/auditQueuePersistence', () => ({
  saveNativeAuditQueue: mocks.save, loadNativeAuditQueueResults: mocks.results,
  acknowledgeNativeAuditQueueResult: mocks.ackResult, loadNativeAuditQueueExecutions: mocks.executions,
  acknowledgeNativeAuditQueueExecution: mocks.ackExecution, deleteNativeAuditQueue: mocks.remove,
  loadNativeAuditQueue: vi.fn(),
}));

const PROJECT = 'coverage-project';
const run = { id: 'run-1', status: 'running', startedAt: 'x', updatedAt: 'x' };
const idle = { batchItems: [], batchRun: null, isBatchRunning: false } as never;

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('seomi_active_project_v1', PROJECT);
  state.activeBatchProjectId = null;
  nativeQueueWrites.clear();
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.wakeup.mockResolvedValue(undefined);
  mocks.invoke.mockResolvedValue(undefined);
  mocks.save.mockResolvedValue(true);
  mocks.remove.mockResolvedValue(true);
  mocks.results.mockResolvedValue([]);
  mocks.executions.mockResolvedValue([]);
  mocks.ackResult.mockResolvedValue(undefined);
  mocks.ackExecution.mockResolvedValue(undefined);
});

describe('audit branch coverage', () => {
  it('passes null to queue wakeup when a later state read loses the run id', () => {
    let reads = 0;
    const get = () => {
      reads += 1;
      if (reads === 1) return { isBatchRunning: false };
      if (reads === 2) return { batchRun: run };
      return { batchRun: { ...run, id: '' } };
    };
    const slice = createAuditBatchSlice(vi.fn(), get as never, {} as never);
    slice.clearBatchAudits();
    expect(mocks.wakeup).toHaveBeenCalledWith(PROJECT, null, false);
  });

  it('keeps a durable native result acknowledged when merged history is empty', async () => {
    mocks.results.mockResolvedValue([{ runId: 'run-1', itemId: 'item-1', audit: { ...mockAudit, timestamp: 'new' } }]);
    const descriptor = Object.getOwnPropertyDescriptor(Array.prototype, 'reduce')!;
    const original = Array.prototype.reduce;
    let intercepted = false;
    Object.defineProperty(Array.prototype, 'reduce', {
      ...descriptor,
      value: function (this: unknown[], ...args: unknown[]) {
        const result = Reflect.apply(original, this, args);
        if (!intercepted && this.length === 1) { intercepted = true; return []; }
        return result;
      },
    });
    const setState = vi.fn();
    try {
      await reconcileNativeBatchResults(PROJECT, () => idle, setState);
    } finally { Object.defineProperty(Array.prototype, 'reduce', descriptor); }
    expect(setState).toHaveBeenCalledWith({ history: [], currentAudit: null });
    expect(mocks.ackResult).toHaveBeenCalledWith(PROJECT, 'run-1', 'item-1');
  });
});
