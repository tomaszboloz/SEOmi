import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createProjectBackup, parseProjectBackup, restoreProjectBackup, serializeProjectBackup, PROJECT_BACKUP_FORMAT } from '@/services/projectBackup';
import { isProjectId, isProject, assertBackupShape } from '@/services/projectBackup/validation';
import { projectStoragePrefix, projectBackupLegacyKeys, readProjectStorage, restoreProjectStorageKey } from '@/services/projectBackup/storage';
import { loadCrawlRuns, saveCrawlRuns } from '@/services/crawlPersistence';
import i18n from '@/i18n';
vi.mock('@/services/crawlPersistence', () => ({ loadCrawlRuns: vi.fn(async () => []), saveCrawlRuns: vi.fn(async () => ({ prunedRuns: 0 })) }));
beforeEach(() => { localStorage.clear(); vi.mocked(loadCrawlRuns).mockReset().mockResolvedValue([]); vi.mocked(saveCrawlRuns).mockReset().mockResolvedValue({ prunedRuns: 0 }); });
afterEach(() => vi.restoreAllMocks());
const project = { id: 'source', name: 'Observed', createdAt: '2026-10-01', lastOpenedAt: '2026-10-01' };
const backup = () => ({ format: PROJECT_BACKUP_FORMAT, exportedAt: '2026-10-01T00:00:00Z', project, localStorage: {}, crawlRuns: [], secretsExcluded: true as const });
it('validates actual project identifiers and metadata without coercion', () => {
  expect(isProjectId('source-1')).toBe(true); expect(isProjectId(4)).toBe(false); expect(isProjectId('../foreign')).toBe(false); expect(isProjectId('x'.repeat(81))).toBe(false);
  expect(isProject(project)).toBe(true); expect(isProject({ ...project, rootUrl: 'https://site.test/' })).toBe(true);
  for (const value of [null, false, {}, { ...project, name: ' ' }, { ...project, name: 'x'.repeat(121) }, { ...project, createdAt: 4 }, { ...project, lastOpenedAt: null }, { ...project, rootUrl: 4 }]) expect(isProject(value)).toBe(false);
});
it.each([
  [null, 'missingProject'], [{ format: 'foreign' }, 'format'], [{ ...backup(), secretsExcluded: false }, 'secrets'],
  [{ ...backup(), project: null }, 'projectMeta'], [{ ...backup(), exportedAt: 4 }, 'date'], [{ ...backup(), exportedAt: 'invalid' }, 'date'],
  [{ ...backup(), localStorage: null }, 'workspace'], [{ ...backup(), localStorage: [] }, 'workspace'],
  [{ ...backup(), localStorage: { ['x'.repeat(4097)]: 'value' } }, 'entry'], [{ ...backup(), localStorage: { ['bad\0key']: 'value' } }, 'entry'],
  [{ ...backup(), localStorage: { observed: 4 } }, 'entry'], [{ ...backup(), crawlRuns: false }, 'crawl'], [{ ...backup(), crawlRuns: [null] }, 'crawl'], [{ ...backup(), crawlRuns: [4] }, 'crawl'],
])('rejects malformed backup evidence %j with localized %s', (value, key) => {
  expect(() => assertBackupShape(value)).toThrow(i18n.t(`runtimeErrors.backup.${key}`));
});
it('exposes JSON input failures distinctly from shape errors', () => {
  for (const value of ['', null, 4]) expect(() => parseProjectBackup(value as string)).toThrow(i18n.t('runtimeErrors.backup.empty'));
  expect(() => parseProjectBackup('{')).toThrow(i18n.t('runtimeErrors.backup.json'));
  expect(parseProjectBackup(serializeProjectBackup(backup()))).toEqual(backup());
});
it('maps all six legacy namespaces exactly, including prefix-like project identifiers', () => {
  expect(projectStoragePrefix('target')).toBe('seomi_project_target_');
  const keys = projectBackupLegacyKeys('seomi'); expect(keys).toHaveLength(6);
  for (const [index, key] of keys.entries()) expect(restoreProjectStorageKey(`__raw__${key}`, 'seomi', 'target')).toBe(projectBackupLegacyKeys('target')[index]);
  expect(restoreProjectStorageKey('active_tab_v1', 'source', 'target')).toBe('seomi_project_target_active_tab_v1');
  expect(() => restoreProjectStorageKey('__raw__seomi_ai_provider', 'source', 'target')).toThrow(i18n.t('runtimeErrors.backup.entry'));
});
it('exports only observed project and allowed legacy keys and snapshots project metadata', async () => {
  localStorage.setItem('seomi_project_source_active_tab_v1', 'overview');
  for (const key of projectBackupLegacyKeys('source')) localStorage.setItem(key, 'observed');
  localStorage.setItem('seomi_gsc_property_other', 'foreign');
  expect(Object.keys(readProjectStorage('source'))).toHaveLength(7);
  const exported = await createProjectBackup(project);
  expect(exported.project).toEqual(project); expect(exported.project).not.toBe(project);
  expect(exported.localStorage).toEqual(readProjectStorage('source')); expect(exported.crawlRuns).toEqual([]);
  expect(loadCrawlRuns).toHaveBeenCalledWith('source');
  await expect(createProjectBackup({ ...project, id: '../outside' })).rejects.toThrow(i18n.t('runtimeErrors.backup.create'));
});
it('restores existing values after a native failure and exposes a localized non-Error failure', async () => {
  localStorage.setItem('seomi_project_target_active_tab_v1', 'keep');
  vi.mocked(saveCrawlRuns).mockRejectedValueOnce('native rejected');
  await expect(restoreProjectBackup({ ...backup(), localStorage: { active_tab_v1: 'overwrite', new: 'new' } }, 'target')).rejects.toThrow(i18n.t('runtimeErrors.backup.restore'));
  expect(localStorage.getItem('seomi_project_target_active_tab_v1')).toBe('keep'); expect(localStorage.getItem('seomi_project_target_new')).toBeNull();
  await expect(restoreProjectBackup(backup(), '../outside')).rejects.toThrow(i18n.t('runtimeErrors.backup.target'));
  expect(await restoreProjectBackup(backup(), 'target')).toMatchObject({ storageEntries: 0, crawlRuns: 0, sourceProjectName: 'Observed' });
});
it('lets other projects restore while a native save is pending', async () => {
  let finish!: (value: { prunedRuns: number }) => void;
  vi.mocked(saveCrawlRuns).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const first = restoreProjectBackup(backup(), 'project-a');
  await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
  const second = await restoreProjectBackup({ ...backup(), localStorage: { active_tab_v1: 'overview' } }, 'project-b');
  expect(second.storageEntries).toBe(1); finish({ prunedRuns: 0 }); await first;
});
