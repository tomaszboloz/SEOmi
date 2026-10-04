import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import * as tauri from '@/services/tauri';
import { settingsHandlersHook } from './fixtures/settingsHandlersHook';
import { deferred } from './fixtures/gscSliceDirect';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const status = (message: string): tauri.UpdateStatus => ({ current_version: '1.0.0', version: `2.0.0-${message}`, available: true, installed: false, restart_required: false });

it.each(['check', 'install'] as const)('older %s results do not overwrite newer results or finish their loading state', async (kind) => {
  const f = settingsHandlersHook(); const old = deferred<tauri.UpdateStatus>(); const current = deferred<tauri.UpdateStatus>();
  const invoke = vi.spyOn(tauri, 'invokeTauriCommand').mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
  const action = () => kind === 'check' ? f.result.current.handleCheckUpdates() : f.result.current.handleInstallUpdate();
  let first!: Promise<void>; let latest!: Promise<void>;
  act(() => { first = action(); }); act(() => { latest = action(); });
  await act(async () => { old.resolve(status('old')); await first; });
  expect(f.result.current.updateStatus).toBeNull();
  expect(kind === 'check' ? f.result.current.checkingUpdates : f.result.current.installingUpdate).toBe(true);
  await act(async () => { current.resolve(status('latest')); await latest; });
  expect(f.result.current.updateStatus).toEqual(status('latest'));
  expect(kind === 'check' ? f.result.current.checkingUpdates : f.result.current.installingUpdate).toBe(false);
  expect(invoke).toHaveBeenCalledTimes(2);
});

it.each(['check', 'install'] as const)('old %s errors do not replace a newer operation result', async (kind) => {
  const f = settingsHandlersHook(); const old = deferred<tauri.UpdateStatus>();
  vi.spyOn(tauri, 'invokeTauriCommand').mockReturnValueOnce(old.promise).mockResolvedValueOnce(status('latest'));
  let pending!: Promise<void>;
  act(() => { pending = kind === 'check' ? f.result.current.handleCheckUpdates() : f.result.current.handleInstallUpdate(); });
  await act(async () => kind === 'check' ? f.result.current.handleInstallUpdate() : f.result.current.handleCheckUpdates());
  await act(async () => { old.reject(new Error('stale')); await pending; });
  expect(f.result.current.updateStatus).toEqual(status('latest'));
  expect(f.result.current.updateError).toBeNull();
  expect(f.result.current.checkingUpdates).toBe(false);
  expect(f.result.current.installingUpdate).toBe(false);
});
