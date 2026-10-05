import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useAIAssistantActions } from '@/components/AI/assistant/useAIAssistantActions';
import { useAsyncOperationScope } from '@/hooks/useAsyncOperationScope';
import type { AiSuggestionResponse } from '@/services/ai';
import type { PageAuditData } from '@/types';
import { createAuditFixture } from './fixtures/audit';
import { clipboard, suggestion, deferred, resetAssistant } from './fixtures/aiAssistantSession';

vi.mock('@/services/clipboard', async () => ({ copyText: (await import('./fixtures/aiAssistantSession')).clipboard }));
beforeEach(resetAssistant);
afterEach(() => vi.useRealTimers());
function setup(response: AiSuggestionResponse | null = suggestion, report: PageAuditData | null = createAuditFixture()) {
  const setAuditData = vi.fn(); const setError = vi.fn();
  const view = renderHook(({ ownerKey, response, report }) => {
    const beginOperation = useAsyncOperationScope(ownerKey);
    return useAIAssistantActions({ ownerKey, suggestions: response, currentAudit: report, setAuditData, setError, beginOperation });
  }, { initialProps: { ownerKey: 'one', response, report } });
  return { ...view, setAuditData, setError, report };
}

it.each(['no-report', 'no-suggestions'])('guards metadata application with %s', missing => {
  const { result, setAuditData } = setup(missing === 'no-suggestions' ? null : suggestion, missing === 'no-report' ? null : createAuditFixture());
  act(() => { result.current.applyTitle(); result.current.applyDescription(); });
  expect(setAuditData).not.toHaveBeenCalled(); expect(result.current.appliedField).toBeNull();
});

it('does not call the clipboard without schema evidence', async () => {
  const { result } = setup({ ...suggestion, schemaJsonLd: undefined });
  await act(async () => { await result.current.copySchema(); });
  expect(clipboard).not.toHaveBeenCalled(); expect(result.current.copiedJson).toBe(false);
});

it('ignores older copy completion while a newer copy is pending', async () => {
  const old = deferred<boolean>(); const latest = deferred<boolean>();
  clipboard.mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise);
  const { result } = setup();
  let first!: Promise<void>; let second!: Promise<void>;
  act(() => { first = result.current.copySchema(); second = result.current.copySchema(); });
  await act(async () => { old.resolve(true); await first; });
  expect(result.current.copiedJson).toBe(false);
  await act(async () => { latest.resolve(false); await second; });
  expect(result.current.copiedJson).toBe(false);
});

it('keeps the newer copied feedback until its own timer expires', async () => {
  vi.useFakeTimers();
  const { result } = setup();
  await act(async () => { await result.current.copySchema(); });
  act(() => vi.advanceTimersByTime(1000));
  await act(async () => { await result.current.copySchema(); });
  act(() => vi.advanceTimersByTime(1000)); expect(result.current.copiedJson).toBe(true);
  act(() => vi.advanceTimersByTime(1000)); expect(result.current.copiedJson).toBe(false);
});

it.each(['owner', 'suggestions', 'unmount'])('ignores old clipboard errors after %s changes', async kind => {
  const pending = deferred<boolean>(); clipboard.mockReturnValueOnce(pending.promise);
  const { result, rerender, unmount, report, setError } = setup();
  let job!: Promise<void>;
  act(() => { job = result.current.copySchema(); });
  if (kind === 'unmount') unmount();
  else rerender({ ownerKey: kind === 'owner' ? 'two' : 'one', response: kind === 'suggestions' ? { ...suggestion, suggestedTitle: 'New' } : suggestion, report });
  await act(async () => { pending.reject(new Error('old clipboard')); await job; });
  expect(setError).not.toHaveBeenCalled();
});

it('resets applied and copied indicators when changing the owner', async () => {
  vi.useFakeTimers();
  const { result, rerender, report } = setup();
  act(() => result.current.applyTitle());
  await act(async () => { await result.current.copySchema(); });
  expect(result.current.appliedField).toBe('title'); expect(result.current.copiedJson).toBe(true);
  rerender({ ownerKey: 'two', response: suggestion, report });
  expect(result.current.appliedField).toBeNull(); expect(result.current.copiedJson).toBe(false);
  act(() => vi.runAllTimers());
  expect(result.current.appliedField).toBeNull(); expect(result.current.copiedJson).toBe(false);
});
