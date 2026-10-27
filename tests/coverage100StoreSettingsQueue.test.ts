import { describe, expect, it } from 'vitest';
import { createSecureSaveQueue } from '@/stores/settings/secureSaveQueue';
import { createSecureActions } from '@/stores/settings/secureActions';

describe('settings secure write queue', () => {
  it('serializes writes, keeps the latest revision and settles only the active promise', async () => {
    const queue = createSecureSaveQueue();
    const firstRevision = queue.begin('key');
    const secondRevision = queue.begin('key');
    expect(queue.isLatest('key', firstRevision)).toBe(false);
    expect(queue.isLatest('key', secondRevision)).toBe(true);
    let release!: () => void;
    const order: string[] = [];
    const first = queue.enqueue('key', () => new Promise<void>((resolve) => { order.push('first'); release = resolve; }));
    const second = queue.enqueue('key', async () => { order.push('second'); });
    expect(queue.pending).toBe(1);
    queue.settle('key', first);
    expect(queue.pending).toBe(1);
    await Promise.resolve();
    await Promise.resolve();
    release();
    await first; await second;
    queue.settle('key', second);
    expect(order).toEqual(['first', 'second']);
    expect(queue.pending).toBe(0);
  });

  it('reports the active project error and clears saving after a failed write', async () => {
    let project = 'one';
    const state = { isSaving: false, secureStorageError: null as string | null };
    const set = (patch: Partial<typeof state>) => Object.assign(state, patch);
    const actions = createSecureActions(set as never, () => project);
    await expect(actions.saveSecure('google', async () => { throw new Error('write failed'); }, () => undefined)).rejects.toThrow('write failed');
    expect(state).toMatchObject({ isSaving: false, secureStorageError: 'write failed' });
    project = '';
    await actions.loadSecure({ googleMetricsApiKey: 'cleared' } as never, async () => ({ googleMetricsApiKey: 'loaded' }));
    expect(state.isSaving).toBe(false);
  });
});
