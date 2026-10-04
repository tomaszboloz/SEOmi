import { vi } from 'vitest';
import { act } from '@testing-library/react';
import { settingsHandlersHook } from './settingsHandlersHook';
import { useProjectStore } from '@/stores/projectStore';
import { useAuditStore } from '@/stores/auditStore';
import { useToolsStore } from '@/stores/toolsStore';
import { useSettingsStore } from '@/stores/settingsStore';
import type { ProjectBackup } from '@/services/projectBackup';
import type { SeoProject } from '@/types';

const adapters = vi.hoisted(() => ({ create: vi.fn(), restore: vi.fn(), download: vi.fn() }));
vi.mock('@/services/projectBackup', async (original) => ({ ...await original<typeof import('@/services/projectBackup')>(), createProjectBackup: adapters.create, restoreProjectBackup: adapters.restore }));
vi.mock('@/services/download', () => ({ downloadBlob: adapters.download }));
export const backupProject = (id = 'one', name = 'Source'): SeoProject => ({ id, name, rootUrl: 'https://example.test', createdAt: '2026-10-01T00:00:00.000Z', lastOpenedAt: '2026-10-01T00:00:00.000Z' });
export const backupDocument = (): ProjectBackup => ({ format: 'seomi-project-backup-v1', exportedAt: '2026-10-01T00:00:00.000Z', project: backupProject(), localStorage: {}, crawlRuns: [], secretsExcluded: true });
export function settingsBackupHook() {
  localStorage.clear();
  adapters.create.mockReset().mockResolvedValue(backupDocument());
  adapters.restore.mockReset().mockResolvedValue({ storageEntries: 0, crawlRuns: 0, sourceProjectName: 'Source' });
  adapters.download.mockReset();
  const f = settingsHandlersHook();
  const createProject = vi.fn(useProjectStore.getInitialState().createProject);
  const selectProject = vi.fn(useProjectStore.getInitialState().selectProject);
  const hydrateAudit = vi.fn(); const hydrateTools = vi.fn().mockResolvedValue(undefined);
  const loadDataForSeo = vi.fn().mockResolvedValue(undefined); const loadGoogle = vi.fn().mockResolvedValue(undefined);
  act(() => {
    useProjectStore.setState({ projects: [backupProject(), backupProject('two', 'Other')], activeProjectId: 'one', createProject, selectProject });
    useAuditStore.setState({ hydrateProject: hydrateAudit }); useToolsStore.setState({ hydrateProject: hydrateTools });
    useSettingsStore.setState({ loadDataForSeoCredentials: loadDataForSeo, loadGoogleMetricsApiKey: loadGoogle });
  });
  return { ...f, ...adapters, createProject, selectProject, hydrateAudit, hydrateTools, loadDataForSeo, loadGoogle };
}
export const backupInputEvent = (text: () => Promise<string>): React.ChangeEvent<HTMLInputElement> => ({ target: { files: [{ text }], value: 'selected.json' } }) as unknown as React.ChangeEvent<HTMLInputElement>;
