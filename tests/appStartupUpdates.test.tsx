import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStartup } from '@/hooks/app/useAppStartup';
import { useSettingsStore } from '@/stores/settingsStore';

const mocks = vi.hoisted(() => ({
  isTauri: vi.fn(() => true),
  invoke: vi.fn(),
  disconnect: vi.fn(),
  connect: vi.fn(),
}));

vi.mock('@/services/tauri', () => ({ isTauriEnvironment: mocks.isTauri, invokeTauriCommand: mocks.invoke }));
vi.mock('@/services/settingsComposition', () => ({ connectSettingsStores: mocks.connect }));

const setConfig = (auto_check_updates: boolean, auto_install_updates: boolean, loadConfig = vi.fn()) =>
  useSettingsStore.setState({ loadConfig, config: { ...useSettingsStore.getState().config, auto_check_updates, auto_install_updates } } as never);

describe('useAppStartup', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.isTauri.mockReturnValue(true);
    mocks.invoke.mockReset();
    mocks.connect.mockReset().mockReturnValue(mocks.disconnect);
    mocks.disconnect.mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it('connects stores, loads config and disconnects on unmount', () => {
    const loadConfig = vi.fn();
    setConfig(false, false, loadConfig);
    const { unmount } = renderHook(() => useAppStartup());
    expect(mocks.connect).toHaveBeenCalledTimes(1);
    expect(loadConfig).toHaveBeenCalledTimes(1);
    unmount();
    expect(mocks.disconnect).toHaveBeenCalledTimes(1);
  });

  it('does not schedule an update check outside Tauri or when disabled', async () => {
    mocks.isTauri.mockReturnValue(false);
    setConfig(true, true);
    renderHook(() => useAppStartup());
    setConfig(false, true);
    mocks.isTauri.mockReturnValue(true);
    renderHook(() => useAppStartup());
    await vi.advanceTimersByTimeAsync(5000);
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it('only checks, without installing, when auto-install is off', async () => {
    setConfig(true, false);
    mocks.invoke.mockResolvedValue({ available: true });
    renderHook(() => useAppStartup());
    await vi.advanceTimersByTimeAsync(3499);
    expect(mocks.invoke).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(mocks.invoke.mock.calls).toEqual([['check_for_updates']]);
  });

  it('skips installing when no update is available', async () => {
    setConfig(true, true);
    mocks.invoke.mockResolvedValue({ available: false });
    renderHook(() => useAppStartup());
    await vi.advanceTimersByTimeAsync(4000);
    expect(mocks.invoke.mock.calls).toEqual([['check_for_updates']]);
  });

  it('installs an available update and broadcasts the installed status', async () => {
    setConfig(true, true);
    const installed = { available: true, installed: true, version: '9.9.9' };
    mocks.invoke.mockImplementation((cmd: string) => Promise.resolve(cmd === 'install_update' ? installed : { available: true }));
    const events: unknown[] = [];
    const handler = (e: Event) => events.push((e as CustomEvent).detail);
    window.addEventListener('seomi-update-installed', handler);
    renderHook(() => useAppStartup());
    await vi.advanceTimersByTimeAsync(4000);
    window.removeEventListener('seomi-update-installed', handler);
    expect(events).toEqual([installed]);
  });

  it('stays silent when installation fails or reports not installed', async () => {
    setConfig(true, true);
    const events: Event[] = [];
    const handler = (e: Event) => events.push(e);
    window.addEventListener('seomi-update-installed', handler);
    mocks.invoke.mockImplementation((cmd: string) => cmd === 'install_update' ? Promise.reject(new Error('no')) : Promise.resolve({ available: true }));
    renderHook(() => useAppStartup());
    await vi.advanceTimersByTimeAsync(4000);
    mocks.invoke.mockImplementation((cmd: string) => Promise.resolve(cmd === 'install_update' ? { installed: false } : { available: true }));
    renderHook(() => useAppStartup());
    await vi.advanceTimersByTimeAsync(4000);
    mocks.invoke.mockRejectedValue(new Error('offline'));
    renderHook(() => useAppStartup());
    await vi.advanceTimersByTimeAsync(4000);
    window.removeEventListener('seomi-update-installed', handler);
    expect(events).toHaveLength(0);
  });

  it('cancels the pending check and drops late results after unmount', async () => {
    setConfig(true, true);
    const { unmount } = renderHook(() => useAppStartup());
    unmount();
    await vi.advanceTimersByTimeAsync(5000);
    expect(mocks.invoke).not.toHaveBeenCalled();
    let resolve!: (v: unknown) => void;
    mocks.invoke.mockReturnValueOnce(new Promise((r) => { resolve = r; }));
    const second = renderHook(() => useAppStartup());
    await vi.advanceTimersByTimeAsync(3500);
    second.unmount();
    resolve({ available: true });
    await vi.advanceTimersByTimeAsync(10);
    expect(mocks.invoke).toHaveBeenCalledTimes(1);
  });
});
