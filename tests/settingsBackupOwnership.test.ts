import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { settingsBackupHook, backupDocument, backupInputEvent } from './fixtures/settingsBackupHook';
import { deferred } from './fixtures/gscSliceDirect';
import { useProjectStore } from '@/stores/projectStore';
import type { ProjectBackup, ProjectBackupSummary } from '@/services/projectBackup';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it.each(['project', 'latest', 'unmount'] as const)('does not download an export after %s invalidation', async (mode) => {
  const f = settingsBackupHook(); const native = deferred<ProjectBackup>(); f.create.mockReturnValueOnce(native.promise);
  let pending!: Promise<void>; act(() => { pending = f.result.current.handleExportProject(); });
  if (mode === 'project') act(() => useProjectStore.getState().selectProject('two'));
  if (mode === 'unmount') f.unmount();
  if (mode === 'latest') await act(async () => f.result.current.handleExportProject());
  f.download.mockClear();
  await act(async () => { native.resolve(backupDocument()); await pending; });
  expect(f.download).not.toHaveBeenCalled();
});

it.each(['project', 'latest', 'unmount'] as const)('does not create a project from a file read invalidated by %s', async (mode) => {
  const f = settingsBackupHook(); const file = deferred<string>();
  let pending!: Promise<void>; act(() => { pending = f.result.current.handleImportProject(backupInputEvent(() => file.promise)); });
  if (mode === 'project') act(() => useProjectStore.getState().selectProject('two'));
  if (mode === 'unmount') f.unmount();
  if (mode === 'latest') await act(async () => f.result.current.handleExportProject());
  await act(async () => { file.resolve(JSON.stringify(backupDocument())); await pending; });
  expect(f.createProject).not.toHaveBeenCalled();
  expect(f.restore).not.toHaveBeenCalled();
});

it('keeps the source project active until restore finishes and does not switch back after the user changes projects', async () => {
  const f = settingsBackupHook(); const native = deferred<ProjectBackupSummary>(); f.restore.mockReturnValueOnce(native.promise);
  let pending!: Promise<void>;
  await act(async () => { pending = f.result.current.handleImportProject(backupInputEvent(async () => JSON.stringify(backupDocument()))); });
  const projectDuringRestore = useProjectStore.getState().activeProjectId;
  act(() => useProjectStore.getState().selectProject('two'));
  await act(async () => { native.resolve({ storageEntries: 0, crawlRuns: 0, sourceProjectName: 'Source' }); await pending; });
  expect(projectDuringRestore).toBe('one');
  expect(useProjectStore.getState().activeProjectId).toBe('two');
  expect(f.hydrateAudit).not.toHaveBeenCalled(); expect(f.hydrateTools).not.toHaveBeenCalled();
  expect(f.loadDataForSeo).not.toHaveBeenCalled(); expect(f.loadGoogle).not.toHaveBeenCalled();
});

it('does not dispatch credential loads after a project switch during own imported-project hydration', async () => {
  const f = settingsBackupHook(); const native = deferred<void>(); f.hydrateTools.mockReturnValueOnce(native.promise);
  let pending!: Promise<void>;
  await act(async () => { pending = f.result.current.handleImportProject(backupInputEvent(async () => JSON.stringify(backupDocument()))); });
  const imported = useProjectStore.getState().projects[0];
  expect(useProjectStore.getState().activeProjectId).toBe(imported.id);
  expect(f.hydrateAudit).toHaveBeenCalledWith(imported.id);
  act(() => useProjectStore.getState().selectProject('two'));
  await act(async () => { native.resolve(); await pending; });
  expect(useProjectStore.getState().activeProjectId).toBe('two');
  expect(f.loadDataForSeo).not.toHaveBeenCalled(); expect(f.loadGoogle).not.toHaveBeenCalled();
  expect(f.result.current.backupStatus).toBeNull();
});

it.each(['export', 'import'] as const)('does not surface stale %s errors in another project', async (kind) => {
  const f = settingsBackupHook();
  const native = deferred<ProjectBackup>(); const file = deferred<string>();
  f.create.mockReturnValueOnce(native.promise);
  let pending!: Promise<void>;
  act(() => { pending = kind === 'export' ? f.result.current.handleExportProject() : f.result.current.handleImportProject(backupInputEvent(() => file.promise)); });
  act(() => useProjectStore.getState().selectProject('two'));
  await act(async () => { if (kind === 'export') native.reject(new Error('stale')); else file.reject(new Error('stale')); await pending; });
  expect(f.result.current.backupStatus).toBeNull();
});
