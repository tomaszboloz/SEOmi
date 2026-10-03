import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UpdatesSettingsTab } from '@/components/Settings/settings/UpdatesSettingsTab';
import { relaunch } from '@tauri-apps/plugin-process';
import type { UpdateStatus } from '@/services/tauri';
import i18n from '@/i18n';

const environment = vi.hoisted(() => ({ native: true }));
vi.mock('@/services/tauri', () => ({ isTauriEnvironment: () => environment.native }));
vi.mock('@tauri-apps/plugin-process', () => ({ relaunch: vi.fn().mockResolvedValue(undefined) }));
afterEach(() => { cleanup(); vi.clearAllMocks(); environment.native = true; });

const available: UpdateStatus = { available: true, installed: false, restart_required: false, version: '0.0.4', current_version: '0.0.3' };
const props = () => ({ updateStatus: null, updateError: null, checkingUpdates: false,
  installingUpdate: false, handleCheckUpdates: vi.fn(), handleInstallUpdate: vi.fn() });

describe('public updater settings view', () => {
  it('offers checking before a result and installation only for a native available update', () => {
    const handlers = props();
    const view = render(<UpdatesSettingsTab {...handlers} />);
    fireEvent.click(screen.getByRole('button', { name: i18n.t('legacyUi.settings.checkUpdates') }));
    expect(handlers.handleCheckUpdates).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: i18n.t('legacyUi.settings.installUpdate') })).toBeNull();
    view.rerender(<UpdatesSettingsTab {...handlers} updateStatus={available} />);
    expect(screen.getByText(i18n.t('legacyUi.settings.updateAvailable', { version: '0.0.4' }))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('legacyUi.settings.installUpdate') }));
    expect(handlers.handleInstallUpdate).toHaveBeenCalledTimes(1);
    environment.native = false;
    view.rerender(<UpdatesSettingsTab {...handlers} updateStatus={available} />);
    const install = screen.getByRole('button', { name: i18n.t('legacyUi.settings.installUpdate') });
    expect((install as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(install); expect(handlers.handleInstallUpdate).toHaveBeenCalledTimes(1);
  });

  it.each(['checkingUpdates', 'installingUpdate'] as const)('prevents a repeated check during %s and exposes errors', (pending) => {
    const handlers = props();
    render(<UpdatesSettingsTab {...handlers} {...{ [pending]: true }} updateStatus={available} updateError="Verification failed" />);
    const check = screen.getByRole('button', { name: i18n.t('legacyUi.settings.checkUpdates') });
    expect((check as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(check); expect(handlers.handleCheckUpdates).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toBe('Verification failed');
    if (pending === 'installingUpdate') {
      expect((screen.getByRole('button', { name: i18n.t('legacyUi.settings.installUpdate') }) as HTMLButtonElement).disabled).toBe(true);
    }
  });

  it('distinguishes installed, current and restart-required states and delegates relaunch', () => {
    const handlers = props();
    const installed = { ...available, installed: true, restart_required: true, version: null };
    const view = render(<UpdatesSettingsTab {...handlers} updateStatus={installed} />);
    expect(screen.getByText(i18n.t('legacyUi.settings.updateInstalled', { version: '' }).replace(/\s+/g, ' ').trim())).toBeTruthy();
    expect(screen.queryByRole('button', { name: i18n.t('legacyUi.settings.installUpdate') })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('legacyUi.settings.restartNow') }));
    expect(relaunch).toHaveBeenCalledTimes(1);
    view.rerender(<UpdatesSettingsTab {...handlers} updateStatus={{ ...available, available: false }} />);
    expect(screen.getByText(i18n.t('legacyUi.settings.upToDate', { version: '0.0.3' }))).toBeTruthy();
    expect(screen.queryByRole('button', { name: i18n.t('legacyUi.settings.restartNow') })).toBeNull();
  });
});
