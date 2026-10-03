import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), native: true }));
vi.mock('@/services/tauri', () => ({ invokeTauriCommand: mocks.invoke, isTauriEnvironment: () => mocks.native }));
import { acknowledgeNativeAuditQueueExecution, acknowledgeNativeAuditQueueResult, deleteNativeAuditQueue,
  loadNativeAuditQueue, loadNativeAuditQueueExecutions, loadNativeAuditQueueResults, saveNativeAuditQueue } from '@/services/auditQueuePersistence';

describe('native audit queue durability contracts', () => {
  beforeEach(() => {
    mocks.native = true;
    mocks.invoke.mockReset();
  });

  it('distinguishes unavailable storage from an available empty queue', async () => {
    mocks.native = false;
    await expect(loadNativeAuditQueue('project-a')).resolves.toEqual({ available: false, snapshot: null });
    expect(mocks.invoke).not.toHaveBeenCalled();
    mocks.native = true;
    mocks.invoke.mockResolvedValue(null);
    await expect(loadNativeAuditQueue('project-a')).resolves.toEqual({ available: true, snapshot: null });
    mocks.invoke.mockRejectedValue(new Error('storage locked'));
    await expect(loadNativeAuditQueue('project-a')).resolves.toEqual({ available: false, snapshot: null });
  });

  it('retains the exact native snapshot and project identity', async () => {
    const snapshot = { items: [{ id: 'item-1' }], run: { id: 'run-1' } };
    mocks.invoke.mockResolvedValue(snapshot);
    await expect(loadNativeAuditQueue('project-b')).resolves.toEqual({ available: true, snapshot });
    expect(mocks.invoke).toHaveBeenCalledExactlyOnceWith('load_project_audit_queue', { projectId: 'project-b' });
  });

  it('reports write and delete failures instead of claiming durable success', async () => {
    const snapshot = { items: [], run: null };
    mocks.invoke.mockResolvedValue(undefined);
    await expect(saveNativeAuditQueue('project-a', snapshot)).resolves.toBe(true);
    expect(mocks.invoke).toHaveBeenLastCalledWith('save_project_audit_queue', { projectId: 'project-a', snapshot });
    await expect(deleteNativeAuditQueue('project-b')).resolves.toBe(true);
    expect(mocks.invoke).toHaveBeenLastCalledWith('delete_project_audit_queue', { projectId: 'project-b' });
    mocks.invoke.mockRejectedValue(new Error('permission denied'));
    await expect(saveNativeAuditQueue('project-a', snapshot)).resolves.toBe(false);
    await expect(deleteNativeAuditQueue('project-a')).resolves.toBe(false);
  });

  it('performs no native work from the browser fallback', async () => {
    mocks.native = false;
    await expect(saveNativeAuditQueue('project-a', { items: [], run: null })).resolves.toBe(false);
    await expect(deleteNativeAuditQueue('project-a')).resolves.toBe(false);
    await expect(loadNativeAuditQueueExecutions('project-a')).resolves.toEqual([]);
    await expect(loadNativeAuditQueueResults('project-a')).resolves.toEqual([]);
    await acknowledgeNativeAuditQueueExecution('project-a', 'run-1');
    await acknowledgeNativeAuditQueueResult('project-a', 'run-1', 'item-1');
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it('accepts only array handoffs and handles unavailable native storage', async () => {
    const records = [{ runId: 'run-1' }];
    mocks.invoke.mockResolvedValue(records);
    await expect(loadNativeAuditQueueExecutions('project-a')).resolves.toBe(records);
    expect(mocks.invoke).toHaveBeenLastCalledWith('list_project_audit_queue_executions', { projectId: 'project-a' });
    await expect(loadNativeAuditQueueResults('project-b')).resolves.toBe(records);
    expect(mocks.invoke).toHaveBeenLastCalledWith('list_project_audit_queue_results', { projectId: 'project-b' });
    for (const value of [null, {}, 'not a handoff']) {
      mocks.invoke.mockResolvedValue(value);
      await expect(loadNativeAuditQueueExecutions('project-a')).resolves.toEqual([]);
      await expect(loadNativeAuditQueueResults('project-a')).resolves.toEqual([]);
    }
    mocks.invoke.mockRejectedValue(new Error('offline'));
    await expect(loadNativeAuditQueueExecutions('project-a')).resolves.toEqual([]);
    await expect(loadNativeAuditQueueResults('project-a')).resolves.toEqual([]);
  });

  it('acknowledges only the requested project, run and item and propagates failures', async () => {
    mocks.invoke.mockResolvedValue(undefined);
    await acknowledgeNativeAuditQueueExecution('project-a', 'run-1');
    expect(mocks.invoke).toHaveBeenLastCalledWith('acknowledge_project_audit_queue_execution', { projectId: 'project-a', runId: 'run-1' });
    await acknowledgeNativeAuditQueueResult('project-b', 'run-2', 'item-2');
    expect(mocks.invoke).toHaveBeenLastCalledWith('acknowledge_project_audit_queue_result', { projectId: 'project-b', runId: 'run-2', itemId: 'item-2' });
    const failure = new Error('ack failed');
    mocks.invoke.mockRejectedValue(failure);
    await expect(acknowledgeNativeAuditQueueExecution('project-a', 'run-1')).rejects.toBe(failure);
    await expect(acknowledgeNativeAuditQueueResult('project-a', 'run-1', 'item-1')).rejects.toBe(failure);
  });
});
