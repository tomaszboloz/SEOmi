import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createBackup: vi.fn(), parseBackup: vi.fn(), restore: vi.fn(), download: vi.fn(),
  hydrateAudit: vi.fn(), hydrateTools: vi.fn(), loadDfs: vi.fn(), loadGoogle: vi.fn(),
}));
vi.mock('@/services/tauri', () => ({ invokeTauriCommand: vi.fn(), isTauriEnvironment: () => true }));
vi.mock('@/services/desktopNotifications', () => ({ areAuditNotificationsEnabled: () => false, enableAuditNotifications: vi.fn(), disableAuditNotifications: vi.fn() }));
vi.mock('@/services/projectBackup', () => ({ createProjectBackup: mocks.createBackup, parseProjectBackup: mocks.parseBackup, restoreProjectBackup: mocks.restore, serializeProjectBackup: () => '{"ok":true}' }));
vi.mock('@/services/download', () => ({ downloadBlob: mocks.download }));

import i18n from '@/i18n';
import { useSettingsHandlers } from '@/components/Settings/settings/settingsHandlers';
import { useAuditStore } from '@/stores/auditStore';
import { useProjectStore } from '@/stores/projectStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useToolsStore } from '@/stores/toolsStore';

const mount = () => renderHook(() => useSettingsHandlers());
const fileEvent = (text: string | null) => {
  const target = { files: text === null ? [] : [{ text: async () => text }], value: 'x' };
  return { event: { target } as never, target };
};

beforeEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage('en');
  useProjectStore.setState({ projects: [{ id: 'p1', name: 'My Shop!', rootUrl: 'https://a.test/' }], activeProjectId: 'p1' } as never);
  useAuditStore.setState({ hydrateProject: mocks.hydrateAudit } as never);
  useToolsStore.setState({ hydrateProject: mocks.hydrateTools } as never);
  useSettingsStore.setState({ loadDataForSeoCredentials: mocks.loadDfs, loadGoogleMetricsApiKey: mocks.loadGoogle } as never);
});

describe('project export', () => {
  it('requires a project, then downloads a file named after it', async () => {
    useProjectStore.setState({ activeProjectId: null });
    const none = mount();
    await act(async () => { await none.result.current.handleExportProject(); });
    expect(none.result.current.backupStatus).toBe(i18n.t('legacyUi.settings.chooseProjectBackup'));
    useProjectStore.setState({ activeProjectId: 'p1' });
    mocks.createBackup.mockResolvedValueOnce({ crawlRuns: [1, 2], localStorage: { a: '1' } });
    const view = mount();
    await act(async () => { await view.result.current.handleExportProject(); });
    expect(mocks.download).toHaveBeenCalledWith('seomi-my-shop-backup.json', expect.any(Blob));
    expect(view.result.current.backupStatus).toBe(i18n.t('legacyUi.settings.backupReady', { runs: 2, entries: 1 }));
  });

  it('falls back to the project id for a name without letters and reports errors', async () => {
    useProjectStore.setState({ projects: [{ id: 'p1', name: '!!!', rootUrl: '' }] } as never);
    mocks.createBackup.mockResolvedValueOnce({ crawlRuns: [], localStorage: {} }).mockRejectedValueOnce(new Error('quota')).mockRejectedValueOnce('x');
    const view = mount();
    await act(async () => { await view.result.current.handleExportProject(); });
    expect(mocks.download.mock.calls[0][0]).toBe('seomi-p1-backup.json');
    await act(async () => { await view.result.current.handleExportProject(); });
    expect(view.result.current.backupStatus).toBe(i18n.t('legacyUi.settings.backupError', { error: 'quota' }));
    await act(async () => { await view.result.current.handleExportProject(); });
    expect(view.result.current.backupStatus).toBe(i18n.t('legacyUi.settings.backupErrorGeneric'));
  });
});

describe('project import', () => {
  it('ignores an empty file selection but still resets the input', async () => {
    const { event, target } = fileEvent(null);
    const view = mount();
    await act(async () => { await view.result.current.handleImportProject(event); });
    expect(target.value).toBe('');
    expect(mocks.parseBackup).not.toHaveBeenCalled();
  });

  it('restores into a new "(import)" project, selects it and reloads dependent state', async () => {
    mocks.parseBackup.mockReturnValueOnce({ project: { name: 'Shop', rootUrl: 'https://a.test/' } });
    mocks.restore.mockResolvedValueOnce({ crawlRuns: 3, storageEntries: 7 });
    const { event } = fileEvent('{}');
    const view = mount();
    await act(async () => { await view.result.current.handleImportProject(event); });
    const imported = useProjectStore.getState().projects.find((project) => project.name === 'Shop (import)');
    expect(imported).toBeTruthy();
    expect(useProjectStore.getState().activeProjectId).toBe(imported!.id);
    expect(mocks.hydrateAudit).toHaveBeenCalledWith(imported!.id);
    expect(mocks.hydrateTools).toHaveBeenCalledWith(imported!.id);
    expect(mocks.loadDfs).toHaveBeenCalled();
    expect(view.result.current.backupStatus).toBe(i18n.t('legacyUi.settings.restoredBackup', { name: 'Shop (import)', runs: 3, entries: 7 }));
  });

  it('reports an invalid backup without creating a project', async () => {
    mocks.parseBackup.mockImplementationOnce(() => { throw new Error('bad version'); }).mockImplementationOnce(() => { throw 'x'; });
    const before = useProjectStore.getState().projects.length;
    const view = mount();
    await act(async () => { await view.result.current.handleImportProject(fileEvent('{}').event); });
    expect(view.result.current.backupStatus).toBe(i18n.t('legacyUi.settings.restoreError', { error: 'bad version' }));
    await act(async () => { await view.result.current.handleImportProject(fileEvent('{}').event); });
    expect(view.result.current.backupStatus).toBe(i18n.t('legacyUi.settings.restoreErrorGeneric'));
    expect(useProjectStore.getState().projects).toHaveLength(before);
  });
});
