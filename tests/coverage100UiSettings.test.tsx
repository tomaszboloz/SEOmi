import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { GeneralSettingsTab } from '@/components/Settings/settings/GeneralSettingsTab';
import { UpdatesSettingsTab } from '@/components/Settings/settings/UpdatesSettingsTab';
import { useProjectStore } from '@/stores/projectStore';
import { useSettingsStore } from '@/stores/settingsStore';
import type { UpdateStatus } from '@/services/tauri';

vi.mock('@/components/Settings/MonitoringAlertsPanel', () => ({ MonitoringAlertsPanel: () => <div data-testid="monitoring" /> }));
vi.mock('@/components/Settings/RenderWorkerPanel', () => ({ RenderWorkerPanel: () => <div data-testid="worker" /> }));
vi.mock('@/services/tauri', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/tauri')>()), isTauriEnvironment: () => true,
}));
vi.mock('@tauri-apps/plugin-process', () => ({ relaunch: vi.fn() }));

const config = {
  theme: 'dark' as const, language: 'en', default_user_agent: 'custom-agent', request_timeout_secs: 30,
  max_redirects: 5, verify_ssl: true, ai_provider: 'openai' as const, auto_check_updates: false, auto_install_updates: false,
};
const status = (patch: Partial<UpdateStatus> = {}): UpdateStatus => ({
  available: false, installed: false, restart_required: false, version: null, current_version: '1.0.0', ...patch,
});
const previousSettings = useSettingsStore.getState();
const previousProjects = useProjectStore.getState();

beforeEach(async () => {
  await i18n.changeLanguage('en');
  act(() => useProjectStore.setState({ activeProjectId: 'settings-project' }));
});
afterEach(() => {
  act(() => {
    useSettingsStore.setState(previousSettings);
    useProjectStore.setState(previousProjects);
  });
});

describe('coverage 100 settings UI edges', () => {
  it('updates theme, notification, numeric, agent and SSL controls', () => {
    const setTheme = vi.fn();
    const updateConfig = vi.fn();
    act(() => useSettingsStore.setState({ theme: 'dark', config, setTheme, updateConfig }));
    const notifications = vi.fn();
    render(<GeneralSettingsTab auditNotificationsEnabled={false} notificationStatus="Permission denied" handleAuditNotificationsChange={notifications} />);
    expect(screen.getByTestId('monitoring')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('Permission denied');
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Light Mode' }));
      fireEvent.click(screen.getByRole('checkbox', { name: /audit notifications/i }));
    });
    expect(setTheme).toHaveBeenCalledWith('light');
    expect(notifications).toHaveBeenCalledWith(true);
    const numbers = screen.getAllByRole('spinbutton');
    act(() => {
      fireEvent.change(numbers[0], { target: { value: '45' } });
      fireEvent.change(numbers[1], { target: { value: '9' } });
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'custom-agent' } });
      fireEvent.click(screen.getByRole('checkbox', { name: /verify/i }));
    });
    expect(updateConfig).toHaveBeenCalledWith({ request_timeout_secs: 45 });
    expect(updateConfig).toHaveBeenCalledWith({ max_redirects: 9 });
    expect(updateConfig).toHaveBeenCalledWith({ default_user_agent: 'custom-agent' });
    expect(updateConfig).toHaveBeenCalledWith({ verify_ssl: false });
  });

  it('renders every update outcome and invokes install and restart actions', async () => {
    const check = vi.fn();
    const install = vi.fn();
    const view = render(<UpdatesSettingsTab updateStatus={status({ available: true, version: '2.0.0' })} updateError="network down" checkingUpdates={true} installingUpdate={false} handleCheckUpdates={check} handleInstallUpdate={install} />);
    expect(screen.getByRole('alert').textContent).toContain('network down');
    expect((screen.getByRole('button', { name: /check for updates/i }) as HTMLButtonElement).disabled).toBe(true);
    act(() => fireEvent.click(screen.getByRole('button', { name: /download and install/i })));
    expect(install).toHaveBeenCalledOnce();
    view.rerender(<UpdatesSettingsTab updateStatus={status({ installed: true, version: '2.0.0' })} updateError={null} checkingUpdates={false} installingUpdate={false} handleCheckUpdates={check} handleInstallUpdate={install} />);
    expect(screen.getByText(/was installed/i)).toBeTruthy();
    view.rerender(<UpdatesSettingsTab updateStatus={status()} updateError={null} checkingUpdates={false} installingUpdate={false} handleCheckUpdates={check} handleInstallUpdate={install} />);
    expect(screen.getByText(/already have version/i)).toBeTruthy();
    view.rerender(<UpdatesSettingsTab updateStatus={status({ available: true, restart_required: true, version: '2.0.0' })} updateError={null} checkingUpdates={false} installingUpdate={true} handleCheckUpdates={check} handleInstallUpdate={install} />);
    const { relaunch } = await import('@tauri-apps/plugin-process');
    act(() => fireEvent.click(screen.getByRole('button', { name: /restart now/i })));
    expect(vi.mocked(relaunch)).toHaveBeenCalledOnce();
    expect((screen.getByRole('button', { name: /download and install/i }) as HTMLButtonElement).disabled).toBe(true);
  });
});
