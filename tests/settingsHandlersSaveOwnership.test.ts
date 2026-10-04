import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { settingsHandlersHook } from './fixtures/settingsHandlersHook';
import { useProjectStore } from '@/stores/projectStore';
import { deferred } from './fixtures/gscSliceDirect';

const event = () => ({ preventDefault: vi.fn() }) as unknown as React.SyntheticEvent;
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });

it.each(['project', 'draft', 'unmount'] as const)('does not dispatch the second secret write after %s invalidation', async (mode) => {
  const f = settingsHandlersHook(); const native = deferred<void>();
  f.saveDataForSeoCredentials.mockReturnValueOnce(native.promise);
  let pending!: Promise<void>;
  act(() => { pending = f.result.current.handleSaveGeneral(event()); });
  if (mode === 'project') act(() => useProjectStore.setState({ activeProjectId: 'two' }));
  if (mode === 'draft') act(() => f.result.current.setGoogleMetricsKey('edited'));
  if (mode === 'unmount') f.unmount();
  await act(async () => { native.resolve(); await pending; });
  expect(f.saveGoogleMetricsApiKey).not.toHaveBeenCalled();
  expect(f.result.current.savedSuccess).toBe(false);
});

it('ignores an older save completion when a newer save is still pending', async () => {
  const f = settingsHandlersHook(); const old = deferred<void>(); const latest = deferred<void>();
  f.saveGoogleMetricsApiKey.mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise);
  let first!: Promise<void>; let second!: Promise<void>;
  await act(async () => { first = f.result.current.handleSaveGeneral(event()); });
  await act(async () => { second = f.result.current.handleSaveGeneral(event()); });
  await act(async () => { old.resolve(); await first; });
  expect(f.result.current.savedSuccess).toBe(false);
  await act(async () => { latest.resolve(); await second; });
  expect(f.result.current.savedSuccess).toBe(true);
});

it('an older success timer does not clear a newer success message', async () => {
  vi.useFakeTimers(); const f = settingsHandlersHook();
  await act(async () => f.result.current.handleSaveGeneral(event()));
  act(() => vi.advanceTimersByTime(1000));
  await act(async () => f.result.current.handleSaveGeneral(event()));
  act(() => vi.advanceTimersByTime(1000));
  expect(f.result.current.savedSuccess).toBe(true);
  act(() => vi.advanceTimersByTime(1000));
  expect(f.result.current.savedSuccess).toBe(false);
});

it.each(['success', 'failure'] as const)('ignores stale credential test %s after changing the draft', async (outcome) => {
  const f = settingsHandlersHook(); const native = deferred<void>();
  f.verify.mockReturnValueOnce(native.promise);
  let pending!: Promise<void>;
  act(() => { pending = f.result.current.handleTestDataForSeo(); });
  act(() => f.result.current.setDataforseoPass('edited'));
  await act(async () => { if (outcome === 'success') native.resolve(); else native.reject(new Error('stale')); await pending; });
  expect(f.result.current.testingDataForSeo).toBe(false);
  expect(f.result.current.dataForSeoTestStatus).toBeNull();
});
