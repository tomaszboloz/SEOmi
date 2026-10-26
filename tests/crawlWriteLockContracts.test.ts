import { describe, expect, it } from 'vitest';
import { assertCrawlWriteGeneration, crawlWriteGeneration, invalidateQueuedCrawlWrites, withCrawlWriteLock } from '@/services/crawlPersistence/writeLock';

describe('crawl write lock generations', () => {
  it('starts at zero and increments per project without touching others', () => {
    expect(crawlWriteGeneration('gen-a')).toBe(0);
    expect(invalidateQueuedCrawlWrites('gen-a')).toBe(1);
    expect(invalidateQueuedCrawlWrites('gen-a')).toBe(2);
    expect(crawlWriteGeneration('gen-a')).toBe(2);
    expect(crawlWriteGeneration('gen-b')).toBe(0);
  });

  it('accepts the current generation and rejects a stale one after erasure', () => {
    const before = crawlWriteGeneration('gen-c');
    expect(() => assertCrawlWriteGeneration('gen-c', before)).not.toThrow();
    invalidateQueuedCrawlWrites('gen-c');
    expect(() => assertCrawlWriteGeneration('gen-c', before)).toThrow('Crawl history write was invalidated by a project erasure.');
  });

  it('serializes writes per project in submission order', async () => {
    const order: string[] = [];
    const slow = withCrawlWriteLock('lock-a', async () => { await new Promise((r) => setTimeout(r, 20)); order.push('first'); return 1; });
    const fast = withCrawlWriteLock('lock-a', async () => { order.push('second'); return 2; });
    expect(await Promise.all([slow, fast])).toEqual([1, 2]);
    expect(order).toEqual(['first', 'second']);
  });

  it('keeps projects independent and continues after a failed write', async () => {
    const order: string[] = [];
    const failing = withCrawlWriteLock('lock-b', async () => { throw new Error('boom'); });
    const next = withCrawlWriteLock('lock-b', async () => 'after');
    const other = withCrawlWriteLock('lock-c', async () => { order.push('other'); return 'x'; });
    await expect(failing).rejects.toThrow('boom');
    await expect(next).resolves.toBe('after');
    await expect(other).resolves.toBe('x');
    expect(order).toEqual(['other']);
  });
});
