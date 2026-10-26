import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createSourcePacer } from '@/services/offPage/sourcePacer';

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); });
afterEach(() => vi.useRealTimers());
it('respects the existing native minimum interval and ten-start sliding window', async () => {
  const wait = createSourcePacer();
  const starts: number[] = [];
  const requests = Array.from({ length: 12 }, () => wait(new AbortController().signal).then(() => { starts.push(Date.now()); }));
  await vi.runAllTimersAsync();
  await Promise.all(requests);
  expect(starts).toEqual([0, 160, 320, 480, 640, 800, 960, 1120, 1280, 1440, 60050, 60210]);
  await vi.advanceTimersByTimeAsync(61000);
  await wait(new AbortController().signal);
  expect(Date.now()).toBe(121210);
});
it('cancels queued waits, clears timers and lets a newer run continue', async () => {
  const wait = createSourcePacer();
  const controller = new AbortController();
  await wait(controller.signal);
  const pending = wait(controller.signal);
  const rejected = expect(pending).rejects.toThrow();
  await Promise.resolve();
  controller.abort();
  await rejected;
  expect(vi.getTimerCount()).toBe(0);
  await expect(wait(controller.signal)).rejects.toThrow();
  const fresh = wait(new AbortController().signal);
  await vi.runAllTimersAsync();
  await fresh;
  expect(Date.now()).toBe(160);
});
