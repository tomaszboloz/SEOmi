import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(), verify: vi.fn(), enable: vi.fn(), disable: vi.fn(), enabled: vi.fn(() => false),
  createBackup: vi.fn(), parseBackup: vi.fn(), restore: vi.fn(), download: vi.fn(),
}));
vi.mock('@/services/tauri', () => ({ invokeTauriCommand: mocks.invoke, isTauriEnvironment: () => true }));
vi.mock('@/services/dataforseo', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/services/dataforseo')>()), DataForSEOClient: vi.fn().mockImplementation(function Client() { return { verifyCredentials: mocks.verify }; }) }));
vi.mock('@/services/desktopNotifications', () => ({ areAuditNotificationsEnabled: mocks.enabled, enableAuditNotifications: mocks.enable, disableAuditNotifications: mocks.disable }));
vi.mock('@/services/projectBackup', () => ({ createProjectBackup: mocks.createBackup, parseProjectBackup: mocks.parseBackup, restoreProjectBackup: mocks.restore, serializeProjectBackup: () => '{}' }));
vi.mock('@/services/download', () => ({ downloadBlob: mocks.download }));

import i18n from '@/i18n';
import { useSettingsHandlers } from '@/components/Settings/settings/settingsHandlers';
import { useProjectStore } from '@/stores/projectStore';
import { useSettingsStore } from '@/stores/settingsStore';

const mount = () => renderHook(() => useSettingsHandlers());
const flush = () => act(async () => { await Promise.resolve(); });

beforeEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage('en');
  useSettingsStore.setState({ dataForSeoCredentials: { login: 'l', password: 'p' }, googleMetricsApiKey: 'g' });
  useProjectStore.setState({ projects: [{ id: 'p1', name: 'My Shop!', rootUrl: 'https://a.test/' }], activeProjectId: 'p1' } as never);
});
afterEach(() => vi.useRealTimers());

describe('credentials and notifications', () => {
  it('starts from the stored credentials and enables project notifications when granted', async () => {
    mocks.enable.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const view = mount();
    expect(view.result.current).toMatchObject({ dataforseoLogin: 'l', dataforseoPass: 'p', googleMetricsKey: 'g' });
    await act(async () => { await view.result.current.handleAuditNotificationsChange(true); });
    expect(view.result.current).toMatchObject({ auditNotificationsEnabled: true, notificationStatus: i18n.t('settings.notificationsEnabled') });
    await act(async () => { await view.result.current.handleAuditNotificationsChange(true); });
    expect(view.result.current.notificationStatus).toBe(i18n.t('settings.notificationsDenied'));
    await act(async () => { await view.result.current.handleAuditNotificationsChange(false); });
    expect(mocks.disable).toHaveBeenCalledWith('p1');
    expect(view.result.current.auditNotificationsEnabled).toBe(false);
  });

  it('ignores notification changes without a project', async () => {
    useProjectStore.setState({ activeProjectId: null });
    const view = mount();
    await act(async () => { await view.result.current.handleAuditNotificationsChange(true); });
    expect(mocks.enable).not.toHaveBeenCalled();
  });

  it('tests DataForSEO credentials and explains failures', async () => {
    const view = mount();
    act(() => { view.result.current.setDataforseoPass(''); });
    await act(async () => { await view.result.current.handleTestDataForSeo(); });
    expect(view.result.current.dataForSeoTestStatus).toBe(i18n.t('dataforseo.enterCredentials'));
    act(() => { view.result.current.setDataforseoLogin(' login '); view.result.current.setDataforseoPass('secret'); });
    mocks.verify.mockRejectedValueOnce(new Error('401')).mockRejectedValueOnce('odd').mockResolvedValueOnce(undefined);
    await act(async () => { await view.result.current.handleTestDataForSeo(); });
    expect(view.result.current.dataForSeoTestStatus).toBe(i18n.t('dataforseo.connectionFailed', { error: '401' }));
    await act(async () => { await view.result.current.handleTestDataForSeo(); });
    expect(view.result.current.dataForSeoTestStatus).toBe(i18n.t('dataforseo.connectionFailed', { error: i18n.t('auditProblems.unknown') }));
    await act(async () => { await view.result.current.handleTestDataForSeo(); });
    expect(view.result.current.dataForSeoTestStatus).toBe(i18n.t('dataforseo.connectionConfirmed'));
    expect(view.result.current.testingDataForSeo).toBe(false);
  });

  it('saves both keys, flashes success for two seconds and swallows a save error', async () => {
    vi.useFakeTimers();
    const dataForSeo = vi.fn().mockResolvedValue(undefined); const google = vi.fn().mockResolvedValue(undefined);
    useSettingsStore.setState({ saveDataForSeoCredentials: dataForSeo, saveGoogleMetricsApiKey: google });
    const view = mount();
    await act(async () => { await view.result.current.handleSaveGeneral({ preventDefault: vi.fn() } as never); });
    expect(dataForSeo).toHaveBeenCalledWith({ login: 'l', password: 'p' });
    expect(google).toHaveBeenCalledWith('g');
    expect(view.result.current.savedSuccess).toBe(true);
    await act(async () => { vi.advanceTimersByTime(2000); });
    expect(view.result.current.savedSuccess).toBe(false);
    dataForSeo.mockRejectedValueOnce(new Error('keychain'));
    await act(async () => { await view.result.current.handleSaveGeneral({ preventDefault: vi.fn() } as never); });
    expect(view.result.current.savedSuccess).toBe(false);
  });
});

describe('updates', () => {
  it('checks for and installs updates and reports errors', async () => {
    mocks.invoke.mockResolvedValueOnce({ available: true }).mockRejectedValueOnce('offline').mockResolvedValueOnce({ installed: true }).mockRejectedValueOnce('signature');
    const view = mount();
    await act(async () => { await view.result.current.handleCheckUpdates(); });
    expect(view.result.current.updateStatus).toEqual({ available: true });
    await act(async () => { await view.result.current.handleCheckUpdates(); });
    expect(view.result.current.updateError).toBe(`${i18n.t('settings.updateError')}: offline`);
    await act(async () => { await view.result.current.handleInstallUpdate(); });
    expect(view.result.current.updateStatus).toEqual({ installed: true });
    await act(async () => { await view.result.current.handleInstallUpdate(); });
    expect(view.result.current.updateError).toBe(`${i18n.t('settings.updateError')}: signature`);
    expect(view.result.current).toMatchObject({ checkingUpdates: false, installingUpdate: false });
    await flush();
  });
});
