import { afterEach, expect, it, vi } from 'vitest';

const deps = vi.hoisted(() => ({
  invoke: vi.fn(),
  migrate: vi.fn(async () => 0),
  write: vi.fn(async () => undefined),
}));

vi.mock('@/services/tauri', () => ({ invokeTauriCommand: deps.invoke }));
vi.mock('@/services/crawlStore', () => ({ migrateLegacyCrawlRuns: deps.migrate }));
vi.mock('@/services/crawlPersistence/indexedDb', () => ({ indexedDbWriteOnce: deps.write }));

import { eraseProjectData, forgetSubject, putSubjectRecord } from '@/services/dataErasure';

const report = { auditId: 1, projectId: 'erasure-a', subjectId: 's', action: 'forget_subject' as const,
  keyId: 'k', recordsDeleted: 2, runsDeleted: 1, atMs: 1 };

afterEach(() => {
  deps.invoke.mockReset();
  deps.migrate.mockClear();
  deps.write.mockClear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

it('forgets a subject after migration and clears every legacy mirror', async () => {
  vi.stubGlobal('indexedDB', {});
  deps.invoke.mockResolvedValue(report);
  for (const key of ['crawl_runs', 'crawl_result', 'crawl_runs_v1_backup']) {
    localStorage.setItem(`seomi_project_erasure-a_${key}`, 'old');
  }
  expect(await forgetSubject('erasure-a', 's')).toEqual(report);
  expect(deps.migrate).toHaveBeenCalledWith('erasure-a');
  expect(deps.invoke).toHaveBeenCalledWith('store_forget_subject', { projectId: 'erasure-a', subjectId: 's' });
  expect(deps.write).toHaveBeenCalledWith('erasure-a', [], []);
  expect(localStorage.getItem('seomi_store_v2_migrated_erasure-a')).toBeNull();
  expect(localStorage.getItem('seomi_project_erasure-a_crawl_runs')).toBeNull();
});

it('does not call the native erasure command when migration fails', async () => {
  deps.migrate.mockRejectedValueOnce(new Error('migration unavailable'));
  await expect(forgetSubject('erasure-b', 's')).rejects.toThrow('migration unavailable');
  expect(deps.invoke).not.toHaveBeenCalled();
  expect(localStorage.getItem('seomi_store_v2_migrated_erasure-b')).toBeNull();
});

it('fails before native work when the migration tombstone cannot be written', async () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key) => {
    if (key === 'seomi_store_v2_migrated_erasure-c') throw new Error('quota');
  });
  await expect(eraseProjectData('erasure-c')).rejects.toThrow('erasure marker');
  expect(deps.invoke).not.toHaveBeenCalled();
});

it('reports a legacy cleanup failure after the native project wipe', async () => {
  vi.stubGlobal('indexedDB', {});
  deps.invoke.mockResolvedValue({ ...report, projectId: 'erasure-d', action: 'erase_project', subjectId: '' });
  localStorage.setItem('seomi_project_erasure-d_crawl_runs', 'old');
  const removeItem = Storage.prototype.removeItem;
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(function (this: Storage, key) {
    if (key === 'seomi_project_erasure-d_crawl_runs') throw new Error('locked');
    return removeItem.call(this, key);
  });
  await expect(eraseProjectData('erasure-d')).rejects.toThrow('seomi_project_erasure-d_crawl_runs');
  expect(deps.invoke).toHaveBeenCalledWith('store_erase_project', { projectId: 'erasure-d' });
});

it('passes subject records through without changing their bytes', async () => {
  deps.invoke.mockResolvedValue(undefined);
  await putSubjectRecord('erasure-e', 'brief', 'key', 'subject', [0, 255, 7]);
  expect(deps.invoke).toHaveBeenCalledWith('store_put_record', {
    projectId: 'erasure-e', kind: 'brief', key: 'key', subjectId: 'subject', data: [0, 255, 7],
  });
});
