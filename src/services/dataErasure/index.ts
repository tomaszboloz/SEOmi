import { invokeTauriCommand } from '@/services/tauri';
import { removeStorage } from '@/services/storage';

/** Evidence returned by the native store after a physical erasure. */
export interface ErasureReport {
  auditId: number;
  projectId: string;
  subjectId: string;
  action: 'forget_subject' | 'erase_project';
  keyId: string;
  recordsDeleted: number;
  runsDeleted: number;
  atMs: number;
}

/** Stores bytes encrypted with the subject's own key (shreddable). */
export const putSubjectRecord = (
  projectId: string, kind: string, key: string, subjectId: string, data: number[],
): Promise<void> => invokeTauriCommand<void>('store_put_record', { projectId, kind, key, subjectId, data });

/** Right to be forgotten: destroys the subject key and deletes tagged rows and runs. */
export const forgetSubject = (projectId: string, subjectId: string): Promise<ErasureReport> =>
  invokeTauriCommand<ErasureReport>('store_forget_subject', { projectId, subjectId });

/** Full project wipe, including leftover Web Storage migration artifacts. */
export const eraseProjectData = async (projectId: string): Promise<ErasureReport> => {
  const report = await invokeTauriCommand<ErasureReport>('store_erase_project', { projectId });
  [`seomi_project_${projectId}_crawl_runs`, `seomi_project_${projectId}_crawl_result`,
    `seomi_project_${projectId}_crawl_runs_v1_backup`, `seomi_store_v2_migrated_${projectId}`].forEach(removeStorage);
  return report;
};

export const loadErasureLog = (projectId: string): Promise<ErasureReport[]> =>
  invokeTauriCommand<ErasureReport[]>('store_erasure_log', { projectId });
