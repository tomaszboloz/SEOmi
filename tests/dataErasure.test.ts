import { afterEach, expect, it, vi } from 'vitest';
import { eraseProjectData, forgetSubject, loadErasureLog, putSubjectRecord } from '../src/services/dataErasure';
import { offPageHistoryKey } from '@/services/offPage/history';

const native = vi.hoisted(() => ({ invokeTauriCommand: vi.fn(), isTauriEnvironment: () => true }));
vi.mock('../src/services/tauri', () => native);
afterEach(() => { native.invokeTauriCommand.mockReset(); localStorage.clear(); });

const report = { auditId: 1, projectId: 'p', subjectId: 's', action: 'forget_subject', keyId: 'k', recordsDeleted: 2, runsDeleted: 0, atMs: 1 };

it('routes subject writes, forget and log through the native store commands', async () => {
  native.invokeTauriCommand.mockImplementation(async (command: string) => {
    if (command === 'load_project_crawl_runs') return [];
    if (command === 'store_import_legacy_runs') return 0;
    return report;
  });
  await putSubjectRecord('p', 'author', 'a1', 's', [1, 2]);
  expect(native.invokeTauriCommand).toHaveBeenLastCalledWith('store_put_record', { projectId: 'p', kind: 'author', key: 'a1', subjectId: 's', data: [1, 2] });
  expect(await forgetSubject('p', 's')).toEqual(report);
  expect(native.invokeTauriCommand).toHaveBeenLastCalledWith('store_forget_subject', { projectId: 'p', subjectId: 's' });
  native.invokeTauriCommand.mockResolvedValue([report]);
  expect(await loadErasureLog('p')).toEqual([report]);
});

it('project erase also clears Web Storage migration artifacts', async () => {
  ['seomi_project_p_crawl_runs', 'seomi_project_p_crawl_runs_v1_backup', 'seomi_store_v2_migrated_p', 'seomi_project_q_crawl_runs']
    .forEach((key) => localStorage.setItem(key, '1'));
  native.invokeTauriCommand.mockResolvedValue({ ...report, action: 'erase_project' });
  expect((await eraseProjectData('p')).action).toBe('erase_project');
  expect(localStorage.length).toBe(1);
  expect(localStorage.getItem('seomi_project_q_crawl_runs')).toBe('1');
});

it.each(['project', 'subject'])('erases off-page history for only the selected %s project', async (scope) => {
  localStorage.setItem(offPageHistoryKey('p'), '[{"id":"private"}]');
  localStorage.setItem(offPageHistoryKey('q'), '[{"id":"keep"}]');
  native.invokeTauriCommand.mockImplementation(async (command: string) => command === 'load_project_crawl_runs' ? [] : report);
  if (scope === 'project') await eraseProjectData('p');
  else await forgetSubject('p', 's');
  expect(localStorage.getItem(offPageHistoryKey('p'))).toBeNull();
  expect(localStorage.getItem(offPageHistoryKey('q'))).toBe('[{"id":"keep"}]');
});
