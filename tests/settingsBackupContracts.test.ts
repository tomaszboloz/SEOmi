import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { settingsBackupHook, backupDocument, backupInputEvent } from './fixtures/settingsBackupHook';
import { useSettingsBackupHandlers } from '@/components/Settings/settings/useSettingsBackupHandlers';
import { useProjectStore } from '@/stores/projectStore';
import { serializeProjectBackup } from '@/services/projectBackup';
import i18n from '@/i18n';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('exports exact backup JSON with a sanitized project filename and real counts', async () => {
  const f = settingsBackupHook();
  act(() => useProjectStore.setState({ projects: useProjectStore.getState().projects.map(project => project.id === 'one' ? { ...project, name: ' Source / Project ' } : project) }));
  await act(async () => f.result.current.handleExportProject());
  expect(f.create).toHaveBeenCalledWith(expect.objectContaining({ id: 'one', name: ' Source / Project ' }));
  const [filename, blob] = f.download.mock.calls[0];
  expect(filename).toBe('seomi-source-project-backup.json');
  expect(blob.type).toBe('application/json');
  const text = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error); reader.readAsText(blob);
  });
  expect(JSON.parse(text)).toEqual(backupDocument());
  expect(text.endsWith('\n')).toBe(true);
  expect(f.result.current.backupStatus).toBe(i18n.t('legacyUi.settings.backupReady', { runs: 0, entries: 0 }));
});

it('uses project ID for a name without filename characters and guards missing active project', async () => {
  const f = settingsBackupHook();
  act(() => useProjectStore.setState({ projects: useProjectStore.getState().projects.map(project => ({ ...project, name: '!!!' })) }));
  await act(async () => f.result.current.handleExportProject());
  expect(f.download.mock.calls[0][0]).toBe('seomi-one-backup.json');
  act(() => useProjectStore.setState({ activeProjectId: null })); f.create.mockClear();
  await act(async () => f.result.current.handleExportProject());
  expect(f.create).not.toHaveBeenCalled();
  expect(f.result.current.backupStatus).toBe(i18n.t('legacyUi.settings.chooseProjectBackup'));
});

it.each([new Error('backup failed'), 'unknown failure'])('reports current export and import failures %s', async (error) => {
  const f = settingsBackupHook(); f.create.mockRejectedValueOnce(error);
  await act(async () => f.result.current.handleExportProject());
  expect(f.result.current.backupStatus).toBe(error instanceof Error ? i18n.t('legacyUi.settings.backupError', { error: error.message }) : i18n.t('legacyUi.settings.backupErrorGeneric'));
  f.restore.mockRejectedValueOnce(error);
  await act(async () => f.result.current.handleImportProject(backupInputEvent(async () => serializeProjectBackup(backupDocument()))));
  expect(f.result.current.backupStatus).toBe(error instanceof Error ? i18n.t('legacyUi.settings.restoreError', { error: error.message }) : i18n.t('legacyUi.settings.restoreErrorGeneric'));
  expect(useProjectStore.getState().activeProjectId).toBe('one');
});

it('ignores empty selection, clears the input and reports invalid JSON before creating a project', async () => {
  const f = settingsBackupHook();
  const empty = { target: { files: [], value: 'old' } } as unknown as React.ChangeEvent<HTMLInputElement>;
  await act(async () => f.result.current.handleImportProject(empty));
  expect(empty.target.value).toBe(''); expect(f.restore).not.toHaveBeenCalled();
  const invalid = backupInputEvent(async () => 'invalid');
  await act(async () => f.result.current.handleImportProject(invalid));
  expect(invalid.target.value).toBe(''); expect(f.createProject).not.toHaveBeenCalled();
  expect(f.result.current.backupStatus).toBeTruthy();
});

it('imports into an inactive new project, activates after restore, and hydrates exactly that project', async () => {
  const f = settingsBackupHook();
  const hook = renderHook(() => useSettingsBackupHandlers());
  const backup = backupDocument(); backup.project.name = 'N'.repeat(79);
  const event = backupInputEvent(async () => serializeProjectBackup(backup));
  await act(async () => hook.result.current.handleImportProject(event));
  expect(event.target.value).toBe('');
  expect(f.createProject).toHaveBeenCalledWith({ name: `${backup.project.name} (import)`.slice(0, 80), rootUrl: backup.project.rootUrl, activate: false });
  const project = useProjectStore.getState().projects[0];
  expect(f.restore).toHaveBeenCalledWith(backup, project.id);
  expect(f.restore.mock.invocationCallOrder[0]).toBeLessThan(f.selectProject.mock.invocationCallOrder[0]);
  expect(useProjectStore.getState().activeProjectId).toBe(project.id);
  expect(f.hydrateAudit).toHaveBeenCalledWith(project.id); expect(f.hydrateTools).toHaveBeenCalledWith(project.id);
  expect(f.loadDataForSeo).toHaveBeenCalledOnce(); expect(f.loadGoogle).toHaveBeenCalledOnce();
  expect(hook.result.current.backupStatus).toBe(i18n.t('legacyUi.settings.restoredBackup', { name: project.name, runs: 0, entries: 0 }));
});

it('reports selection failure without losing ownership of the source project', async () => {
  const f = settingsBackupHook(); f.selectProject.mockImplementationOnce(() => { throw new Error('selection failed'); });
  await act(async () => f.result.current.handleImportProject(backupInputEvent(async () => serializeProjectBackup(backupDocument()))));
  expect(useProjectStore.getState().activeProjectId).toBe('one');
  expect(f.hydrateAudit).not.toHaveBeenCalled(); expect(f.hydrateTools).not.toHaveBeenCalled();
  expect(f.result.current.backupStatus).toBe(i18n.t('legacyUi.settings.restoreError', { error: 'selection failed' }));
});
