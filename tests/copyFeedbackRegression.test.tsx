import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import '@/i18n';
import { useLinkVerification } from '@/components/Results/links/useLinkVerification';
import { copyText } from '@/services/clipboard';

vi.mock('@/services/clipboard', () => ({ copyText: vi.fn() }));
beforeEach(() => { vi.useFakeTimers(); vi.mocked(copyText).mockResolvedValue(true); });
afterEach(() => { vi.useRealTimers(); });

it('keeps the confirmation of the latest copied link for its full duration', async () => {
  const { result } = renderHook(() => useLinkVerification());
  await act(async () => { await result.current.handleCopy('https://a.test/1'); });
  await act(async () => { vi.advanceTimersByTime(1000); });
  await act(async () => { await result.current.handleCopy('https://a.test/2'); });
  await act(async () => { vi.advanceTimersByTime(1000); });
  expect(result.current.copiedUrl).toBe('https://a.test/2');
  await act(async () => { vi.advanceTimersByTime(500); });
  expect(result.current.copiedUrl).toBeNull();
});

it('does not confirm a copy the clipboard rejected', async () => {
  vi.mocked(copyText).mockResolvedValue(false);
  const { result } = renderHook(() => useLinkVerification());
  await act(async () => { await result.current.handleCopy('https://a.test/1'); });
  expect(result.current.copiedUrl).toBeNull();
});
