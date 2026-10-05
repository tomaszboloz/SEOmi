import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nativeQueueWrites, state } from '@/stores/audit/auditConstants';
import { clearNativeBatchSnapshot, persistNativeBatchSnapshot, reconcileNativeBatchResults } from '@/stores/audit/auditNative';
import { mockAudit } from './fixtures/auditStoreContracts';

const q = vi.hoisted(() => ({
  save: vi.fn(), results: vi.fn(), ackResult: vi.fn(), executions: vi.fn(), ackExecution: vi.fn(), remove: vi.fn(), load: vi.fn(),
}));
vi.mock('@/services/auditQueuePersistence', () => ({
  saveNativeAuditQueue: q.save, loadNativeAuditQueueResults: q.results, acknowledgeNativeAuditQueueResult: q.ackResult,
  loadNativeAuditQueueExecutions: q.executions, acknowledgeNativeAuditQueueExecution: q.ackExecution,
  deleteNativeAuditQueue: q.remove, loadNativeAuditQueue: q.load,
}));

const P = 'project-a';
const audit = (n: number) => ({ ...mockAudit, url: `https://a.test/${n}`, final_url: `https://a.test/${n}`, timestamp: `t${n}` });
const item = (id: string, status = 'queued') => ({ id, url: `https://a.test/${id}`, status, updatedAt: 'x' });
const run = { id: 'r1', status: 'running', startedAt: 'x', updatedAt: 'x' };
const idle = { batchItems: [], batchRun: null, isBatchRunning: false } as never;
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

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

describe('native snapshot writes', () => {
  it('serialises writes per project, caps items and releases the slot afterwards', async () => {
    const order: string[] = [];
    q.save.mockImplementation(async (_p: string, snap: { items: unknown[] }) => { order.push(`save${snap.items.length}`); return true; });
    q.remove.mockImplementation(async () => { order.push('delete'); return true; });
    persistNativeBatchSnapshot(P, Array.from({ length: 50_001 }, (_, i) => item(String(i))) as never, null);
    clearNativeBatchSnapshot(P);
    persistNativeBatchSnapshot(P, [item('1')] as never, run as never);
    expect(nativeQueueWrites.has(P)).toBe(true);
    await flush(); await flush();
    expect(order).toEqual(['save50000', 'delete', 'save1']);
    expect(nativeQueueWrites.has(P)).toBe(false);
  });
});

describe('reconcileNativeBatchResults', () => {
  it('returns early when the project changed or a batch runs', async () => {
    q.results.mockResolvedValue([{ runId: 'r', itemId: 'i', audit: audit(1) }]);
    localStorage.setItem('seomi_active_project_v1', 'other');
    await reconcileNativeBatchResults(P, () => idle, vi.fn());
    localStorage.setItem('seomi_active_project_v1', P);
    await reconcileNativeBatchResults(P, () => ({ ...(idle as object), isBatchRunning: true }) as never, vi.fn());
    expect(q.ackResult).not.toHaveBeenCalled();
    expect(q.executions).not.toHaveBeenCalled();
  });

  it.each([[null], ['x'], [{}], [{ runId: 1, itemId: 'i', audit: {} }], [{ runId: 'r', itemId: 2, audit: {} }], [{ runId: 'r', itemId: 'i' }], [{ runId: 'r', itemId: 'i', audit: 'a' }], [{ runId: 'r', itemId: 'i', audit: { url: 1, timestamp: 't' } }], [{ runId: 'r', itemId: 'i', audit: { url: 'u' } }]])('ignores malformed result %j', async (entry) => {
    q.results.mockResolvedValue([entry]);
    const setState = vi.fn();
    await reconcileNativeBatchResults(P, () => idle, setState);
    expect(setState).not.toHaveBeenCalled();
    expect(q.ackResult).not.toHaveBeenCalled();
  });

  it('merges recovered audits newest-first, deduplicates, caps at 25 and acknowledges each', async () => {
    localStorage.setItem(`seomi_project_${P}_audit_history`, JSON.stringify([audit(1)]));
    q.results.mockResolvedValue([{ runId: 'r', itemId: 'a', audit: audit(1) }, { runId: 'r', itemId: 'b', audit: audit(2) }, { runId: 'r', itemId: 'c', audit: { ...audit(2), timestamp: 'later' } }]);
    q.ackResult.mockRejectedValueOnce(new Error('ack failed'));
    const setState = vi.fn();
    await reconcileNativeBatchResults(P, () => idle, setState);
    const patch = setState.mock.calls[0][0];
    expect(patch.history.map((a: { timestamp: string }) => a.timestamp)).toEqual(['later', 't1']);
    expect(patch.currentAudit).toBe(patch.history[0]);
    expect(q.ackResult.mock.calls.map((c) => c[2])).toEqual(['a', 'b', 'c']);
  });

  it('keeps native results unacknowledged when history cannot be saved', async () => {
    q.results.mockResolvedValue([{ runId: 'r', itemId: 'a', audit: audit(1) }]);
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError'); });
    const setState = vi.fn();
    await reconcileNativeBatchResults(P, () => idle, setState);
    spy.mockRestore();
    expect(setState).not.toHaveBeenCalled();
    expect(q.ackResult).not.toHaveBeenCalled();
  });

  it('acknowledges only well-formed executions and tolerates ack failure', async () => {
    q.executions.mockResolvedValue([null, 'x', {}, { runId: 5 }, { runId: 'r1' }, { runId: 'r2' }]);
    q.ackExecution.mockRejectedValueOnce(new Error('x'));
    await reconcileNativeBatchResults(P, () => idle, vi.fn());
    expect(q.ackExecution.mock.calls.map((c) => c[1])).toEqual(['r1', 'r2']);
  });
});
