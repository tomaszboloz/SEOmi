import { afterEach, expect, it, vi } from 'vitest';
import { eraseProjectData, forgetSubject, loadErasureLog, putSubjectRecord } from '../src/services/dataErasure';

const native = vi.hoisted(() => ({ invokeTauriCommand: vi.fn(), isTauriEnvironment: () => true }));
vi.mock('../src/services/tauri', () => native);
afterEach(() => { native.invokeTauriCommand.mockReset(); localStorage.clear(); });

const report = { auditId: 1, projectId: 'p', subjectId: 's', action: 'forget_subject', keyId: 'k', recordsDeleted: 2, runsDeleted: 0, atMs: 1 };

it('routes subject writes, forget and log through the native store commands', async () => {
  native.invokeTauriCommand.mockResolvedValue(report);
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
