import { describe, expect, it } from 'vitest';
import { createSecureSaveQueue } from '@/stores/settings/secureSaveQueue';

const deferred = () => {
  let resolve!: () => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<void>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

describe('createSecureSaveQueue', () => {
  it('numbers revisions per key and reports only the latest as current', () => {
    const queue = createSecureSaveQueue();
    const first = queue.begin('a');
    const second = queue.begin('a');
    expect([first, second, queue.begin('b')]).toEqual([1, 2, 1]);
    expect(queue.isLatest('a', first)).toBe(false);
    expect(queue.isLatest('a', second)).toBe(true);
    expect(queue.isLatest('missing', 1)).toBe(false);
  });

  it('runs writes for the same key strictly in order', async () => {
    const queue = createSecureSaveQueue();
    const order: string[] = [];
    const gate = deferred();
    const one = queue.enqueue('k', async () => { await gate.promise; order.push('one'); });
    const two = queue.enqueue('k', async () => { order.push('two'); });
    expect(queue.pending).toBe(1);
    expect(order).toEqual([]);
    gate.resolve();
    await Promise.all([one, two]);
    expect(order).toEqual(['one', 'two']);
  });

  it('still runs a queued write after the previous write failed', async () => {
    const queue = createSecureSaveQueue();
    const failing = queue.enqueue('k', () => Promise.reject(new Error('boom')));
    const next = queue.enqueue('k', async () => 'value');
    await expect(failing).rejects.toThrow('boom');
    await expect(next).resolves.toBeUndefined();
  });

  it('settles a queue only when the finished save is still the tail', async () => {
    const queue = createSecureSaveQueue();
    const one = queue.enqueue('k', async () => undefined);
    const two = queue.enqueue('k', async () => undefined);
    await Promise.all([one, two]);
    queue.settle('k', one);
    expect(queue.pending).toBe(1);
    queue.settle('k', two);
    expect(queue.pending).toBe(0);
  });
});
