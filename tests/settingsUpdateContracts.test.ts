import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import * as tauri from '@/services/tauri';
import { useSettingsUpdateHandlers } from '@/components/Settings/settings/useSettingsUpdateHandlers';
import { deferred } from './fixtures/gscSliceDirect';
import i18n from '@/i18n';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const status: tauri.UpdateStatus = { current_version: '1.0.0', version: '2.0.0', available: true, installed: false, restart_required: false };

it.each(['check', 'install'] as const)('dispatches exact %s command, loading flag and successful result', async (kind) => {
  const native = deferred<tauri.UpdateStatus>();
  const invoke = vi.spyOn(tauri, 'invokeTauriCommand').mockReturnValueOnce(native.promise);
  const f = renderHook(() => useSettingsUpdateHandlers()); let pending!: Promise<void>;
  act(() => { pending = kind === 'check' ? f.result.current.handleCheckUpdates() : f.result.current.handleInstallUpdate(); });
  expect(invoke).toHaveBeenCalledExactlyOnceWith(kind === 'check' ? 'check_for_updates' : 'install_update');
  expect(kind === 'check' ? f.result.current.checkingUpdates : f.result.current.installingUpdate).toBe(true);
  await act(async () => { native.resolve(status); await pending; });
  expect(f.result.current).toMatchObject({ updateStatus: status, updateError: null, checkingUpdates: false, installingUpdate: false });
});

it.each(['check', 'install'] as const)('reports current %s errors and clears them on retry', async (kind) => {
  for (const error of [new Error('native error'), 'unknown error']) {
    vi.spyOn(tauri, 'invokeTauriCommand').mockRejectedValueOnce(error).mockResolvedValueOnce(status);
    const f = renderHook(() => useSettingsUpdateHandlers());
    const action = () => kind === 'check' ? f.result.current.handleCheckUpdates() : f.result.current.handleInstallUpdate();
    await act(async () => action());
    expect(f.result.current.updateError).toBe(`${i18n.t('settings.updateError')}: ${String(error)}`);
    expect(f.result.current.checkingUpdates).toBe(false); expect(f.result.current.installingUpdate).toBe(false);
    await act(async () => action());
    expect(f.result.current.updateError).toBeNull(); expect(f.result.current.updateStatus).toEqual(status);
    f.unmount(); vi.restoreAllMocks();
  }
});

it('retains available-update evidence while installing and clears it for a new check', async () => {
  const native = deferred<tauri.UpdateStatus>();
  const invoke = vi.spyOn(tauri, 'invokeTauriCommand').mockResolvedValueOnce(status).mockReturnValueOnce(native.promise);
  const f = renderHook(() => useSettingsUpdateHandlers());
  await act(async () => f.result.current.handleCheckUpdates());
  let pending!: Promise<void>; act(() => { pending = f.result.current.handleInstallUpdate(); });
  expect(f.result.current.updateStatus).toEqual(status);
  await act(async () => { native.resolve(status); await pending; });
  const check = deferred<tauri.UpdateStatus>(); invoke.mockReturnValueOnce(check.promise);
  act(() => { pending = f.result.current.handleCheckUpdates(); });
  expect(f.result.current.updateStatus).toBeNull();
  await act(async () => { check.resolve({ ...status, available: false, version: null }); await pending; });
  expect(f.result.current.updateStatus?.available).toBe(false);
});
