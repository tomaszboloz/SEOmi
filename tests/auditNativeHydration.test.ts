import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nativeQueueWrites, state } from '@/stores/audit/auditConstants';
import { hydrateNativeBatchQueue } from '@/stores/audit/auditNative';

const q = vi.hoisted(() => ({
  save: vi.fn(), results: vi.fn(), ackResult: vi.fn(), executions: vi.fn(), ackExecution: vi.fn(), remove: vi.fn(), load: vi.fn(),
}));
vi.mock('@/services/auditQueuePersistence', () => ({
  saveNativeAuditQueue: q.save, loadNativeAuditQueueResults: q.results, acknowledgeNativeAuditQueueResult: q.ackResult,
  loadNativeAuditQueueExecutions: q.executions, acknowledgeNativeAuditQueueExecution: q.ackExecution,
  deleteNativeAuditQueue: q.remove, loadNativeAuditQueue: q.load,
}));

const P = 'project-a';
const item = (id: string, status = 'queued') => ({ id, url: `https://a.test/${id}`, status, updatedAt: 'x' });
const run = { id: 'r1', status: 'running', startedAt: 'x', updatedAt: 'x' };

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('seomi_active_project_v1', P);
  state.activeBatchProjectId = null;
  nativeQueueWrites.clear();
  Object.values(q).forEach((fn) => fn.mockReset());
  q.save.mockResolvedValue(true); q.remove.mockResolvedValue(true);
  q.results.mockResolvedValue([]); q.executions.mockResolvedValue([]);
  q.ackResult.mockResolvedValue(undefined); q.ackExecution.mockResolvedValue(undefined);
});

describe('hydrateNativeBatchQueue', () => {
  const read = (extra: object = {}) => () => ({ batchItems: [], batchRun: null, isBatchRunning: false, ...extra }) as never;

  it('does nothing when the native store is unavailable or the project changed', async () => {
    q.load.mockResolvedValue({ available: false, snapshot: null });
    await hydrateNativeBatchQueue(P, read(), vi.fn());
    q.load.mockImplementation(async () => { localStorage.setItem('seomi_active_project_v1', 'other'); return { available: true, snapshot: null }; });
    await hydrateNativeBatchQueue(P, read(), vi.fn());
    expect(q.save).not.toHaveBeenCalled();
  });

  it('leaves a running batch alone', async () => {
    q.load.mockResolvedValue({ available: true, snapshot: { items: [], run: null } });
    const setState = vi.fn();
    await hydrateNativeBatchQueue(P, read({ isBatchRunning: true }), setState);
    state.activeBatchProjectId = P;
    await hydrateNativeBatchQueue(P, read(), setState);
    expect(setState).not.toHaveBeenCalled();
  });

  it('writes local state back when it changed while loading', async () => {
    let calls = 0;
    const readState = () => ({ batchItems: calls++ === 0 ? [] : [item('1')], batchRun: null, isBatchRunning: false }) as never;
    q.load.mockResolvedValue({ available: true, snapshot: { items: [], run: null } });
    const setState = vi.fn();
    await hydrateNativeBatchQueue(P, readState, setState);
    expect(setState).not.toHaveBeenCalled();
    expect(q.save).toHaveBeenCalledTimes(1);
  });

  it('seeds an empty native store from local state and reconciles results', async () => {
    q.load.mockResolvedValue({ available: true, snapshot: null });
    await hydrateNativeBatchQueue(P, read({ batchItems: [item('1')] }), vi.fn());
    expect(q.save).toHaveBeenCalledTimes(1);
    expect(q.results).toHaveBeenCalled();
  });

  it.each([[undefined], ['text'], [{}], [{ items: 'no' }], [{ items: [], run: { id: 1 } }]])('ignores invalid snapshot %j', async (snapshot) => {
    q.load.mockResolvedValue({ available: true, snapshot });
    const setState = vi.fn();
    await hydrateNativeBatchQueue(P, read(), setState);
    expect(setState).not.toHaveBeenCalled();
    expect(q.save).not.toHaveBeenCalled();
  });

  it('adopts a valid snapshot, marks running items interrupted and persists it everywhere', async () => {
    q.load.mockResolvedValue({ available: true, snapshot: { items: [item('1', 'running'), item('2'), { bad: true }], run } });
    const setState = vi.fn();
    await hydrateNativeBatchQueue(P, read(), setState);
    const patch = setState.mock.calls[0][0];
    expect(patch.batchItems.map((entry: { status: string }) => entry.status)).toEqual(['interrupted', 'queued']);
    expect(patch.batchRun.status).toBe('interrupted');
    expect(JSON.parse(localStorage.getItem(`seomi_project_${P}_audit_queue_v1`) || '[]')).toHaveLength(2);
    expect(q.save).toHaveBeenCalledTimes(1);
    expect(q.results).toHaveBeenCalled();
  });

  it('accepts a snapshot without a run, and drops the result when a batch started meanwhile', async () => {
    q.load.mockResolvedValue({ available: true, snapshot: { items: [item('1')] } });
    const setState = vi.fn();
    await hydrateNativeBatchQueue(P, read(), setState);
    expect(setState.mock.calls[0][0].batchRun).toBeNull();
    setState.mockClear();
    let calls = 0;
    const racing = () => ({ batchItems: [], batchRun: null, isBatchRunning: calls++ >= 2 }) as never;
    await hydrateNativeBatchQueue(P, racing, setState);
    expect(setState).not.toHaveBeenCalled();
  });
});
