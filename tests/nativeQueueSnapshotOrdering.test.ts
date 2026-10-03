import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nativeQueueWrites } from '@/stores/audit/auditConstants';
import { clearNativeBatchSnapshot, persistNativeBatchSnapshot } from '@/stores/audit/auditNative';

const adapter = vi.hoisted(() => ({ save: vi.fn(), remove: vi.fn() }));
vi.mock('@/services/auditQueuePersistence', () => ({ saveNativeAuditQueue: adapter.save, deleteNativeAuditQueue: adapter.remove }));

beforeEach(() => { nativeQueueWrites.clear(); adapter.save.mockReset(); adapter.remove.mockReset(); });

describe('public native queue snapshot ordering', () => {
  it.each([true, false])('clears a project snapshot and releases the queue when adapter returns %s', async (deleted) => {
    adapter.remove.mockResolvedValue(deleted);
    expect(clearNativeBatchSnapshot('project-a')).toBeUndefined();
    const pending = nativeQueueWrites.get('project-a');
    expect(pending).toBeInstanceOf(Promise);
    await pending;
    expect(adapter.remove).toHaveBeenCalledExactlyOnceWith('project-a');
    await vi.waitFor(() => expect(nativeQueueWrites.has('project-a')).toBe(false));
  });

  it('waits for the preceding write and keeps the other project queue isolated', async () => {
    let finishWrite!: (saved: boolean) => void;
    const writing = new Promise<boolean>((resolve) => { finishWrite = resolve; });
    const other = Promise.resolve(true);
    nativeQueueWrites.set('project-b', other);
    adapter.save.mockReturnValue(writing); adapter.remove.mockResolvedValue(true);
    persistNativeBatchSnapshot('project-a', [], null);
    await vi.waitFor(() => expect(adapter.save).toHaveBeenCalledExactlyOnceWith('project-a', { items: [], run: null }));
    clearNativeBatchSnapshot('project-a');
    const clearing = nativeQueueWrites.get('project-a');
    expect(adapter.remove).not.toHaveBeenCalled();
    finishWrite(false);
    await clearing;
    expect(adapter.remove).toHaveBeenCalledExactlyOnceWith('project-a');
    await vi.waitFor(() => expect(nativeQueueWrites.has('project-a')).toBe(false));
    expect(nativeQueueWrites.get('project-b')).toBe(other);
  });
});
