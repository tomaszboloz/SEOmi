import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useTransientValue } from '@/hooks/useTransientValue';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

it('starts idle, shows a flashed value and reverts after the duration', () => {
  const { result } = renderHook(() => useTransientValue<string | null>(null, 1500));
  expect(result.current[0]).toBeNull();
  act(() => result.current[1]('a'));
  expect(result.current[0]).toBe('a');
  act(() => { vi.advanceTimersByTime(1499); });
  expect(result.current[0]).toBe('a');
  act(() => { vi.advanceTimersByTime(1); });
  expect(result.current[0]).toBeNull();
});

it('restarts the timer so an earlier flash cannot clear a later one', () => {
  const { result } = renderHook(() => useTransientValue<string | null>(null, 1500));
  act(() => result.current[1]('a'));
  act(() => { vi.advanceTimersByTime(1000); });
  act(() => result.current[1]('b'));
  act(() => { vi.advanceTimersByTime(1000); });
  expect(result.current[0]).toBe('b');
  act(() => { vi.advanceTimersByTime(500); });
  expect(result.current[0]).toBeNull();
});

it('clears the pending timer on unmount', () => {
  const { result, unmount } = renderHook(() => useTransientValue(false, 2000));
  act(() => result.current[1](true));
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});

it('keeps a stable flash function between renders', () => {
  const { result, rerender } = renderHook(() => useTransientValue(false, 2000));
  const first = result.current[1];
  rerender();
  expect(result.current[1]).toBe(first);
});
