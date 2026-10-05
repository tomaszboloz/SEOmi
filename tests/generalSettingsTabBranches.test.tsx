import { render, screen, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { GeneralSettingsTab } from '@/components/Settings/settings/GeneralSettingsTab';
import { useSettingsStore } from '@/stores/settingsStore';
import { useProjectStore } from '@/stores/projectStore';

const mocks = vi.hoisted(() => ({ tauri: true }));
vi.mock('@/services/tauri', () => ({ isTauriEnvironment: () => mocks.tauri }));
vi.mock('@/components/Settings/RenderWorkerPanel', () => ({ RenderWorkerPanel: () => <div data-testid="worker-panel" /> }));

const settings = useSettingsStore.getState();
const projects = useProjectStore.getState();
const setTheme = vi.fn();
const updateConfig = vi.fn();
const t = (k: string) => i18n.t(k);
const setup = (props: Partial<{ enabled: boolean; status: string | null }> = {}, config: object = {}) => {
  const onChange = vi.fn();
  useSettingsStore.setState({ theme: 'dark', setTheme, updateConfig, config: { ...settings.config, ...config } } as never);
  render(<GeneralSettingsTab auditNotificationsEnabled={props.enabled ?? false} notificationStatus={props.status ?? null} handleAuditNotificationsChange={onChange} />);
  return onChange;
};
beforeEach(async () => { await i18n.changeLanguage('en'); vi.clearAllMocks(); mocks.tauri = true; useProjectStore.setState({ activeProjectId: 'p1' }); });
afterEach(() => { useSettingsStore.setState(settings); useProjectStore.setState(projects); });

it('switches theme and highlights the active one', () => {
  setup();
  const dark = screen.getByRole('button', { name: t('settings.dark') });
  const light = screen.getByRole('button', { name: t('settings.light') });
  expect(dark.className).toContain('text-emerald-400');
  expect(light.className).not.toContain('text-emerald-400');
  fireEvent.click(light);
  fireEvent.click(screen.getByRole('button', { name: t('settings.system') }));
  fireEvent.click(dark);
  expect(setTheme.mock.calls.map((c) => c[0])).toEqual(['light', 'system', 'dark']);
});

it('toggles audit notifications and shows the status message', () => {
  const onChange = setup({ enabled: false, status: 'Permission denied' });
  const box = screen.getByRole('checkbox', { name: t('settings.auditNotifications') }) as HTMLInputElement;
  expect(box.disabled).toBe(false);
  fireEvent.click(box);
  expect(onChange).toHaveBeenCalledWith(true);
  expect(screen.getByRole('status').textContent).toBe('Permission denied');
});

it.each([[false, 'p1'], [true, null]])('disables notifications when tauri=%s project=%s is unavailable', (tauri, project) => {
  mocks.tauri = tauri; useProjectStore.setState({ activeProjectId: project });
  setup();
  expect((screen.getByRole('checkbox', { name: t('settings.auditNotifications') }) as HTMLInputElement).disabled).toBe(true);
  expect(screen.queryByRole('status')).toBeNull();
});

it('updates numeric limits, user agent and ssl verification through updateConfig', () => {
  setup({}, { request_timeout_secs: 10, max_redirects: 5, default_user_agent: 'chrome_mac', verify_ssl: true });
  fireEvent.change(screen.getByDisplayValue('10'), { target: { value: '25' } });
  fireEvent.change(screen.getByDisplayValue('5'), { target: { value: '9' } });
  fireEvent.change(screen.getByLabelText(t('settings.defaultUserAgent')), { target: { value: 'bingbot' } });
  fireEvent.click(screen.getByRole('checkbox', { name: new RegExp(t('settings.verifySsl')) }));
  expect(updateConfig.mock.calls.map((c) => c[0])).toEqual([{ request_timeout_secs: 25 }, { max_redirects: 9 }, { default_user_agent: 'bingbot' }, { verify_ssl: false }]);
  expect(screen.getByTestId('worker-panel')).toBeTruthy();
  expect(screen.getByLabelText(t('settings.defaultUserAgent')).querySelectorAll('option')).toHaveLength(7);
});

it('keeps an unknown stored user agent selectable', () => {
  setup({}, { default_user_agent: 'custom-bot/1.0' });
  const select = screen.getByLabelText(t('settings.defaultUserAgent')) as HTMLSelectElement;
  expect(select.querySelectorAll('option')).toHaveLength(8);
  expect(select.value).toBe('custom-bot/1.0');
});
