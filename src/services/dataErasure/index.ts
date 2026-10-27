import { invokeTauriCommand } from '@/services/tauri';
import { readStorage, removeStorage, writeStorage } from '@/services/storage';
import { indexedDbWriteOnce } from '@/services/crawlPersistence/indexedDb';
import { invalidateQueuedCrawlWrites, withCrawlWriteLock } from '@/services/crawlPersistence/writeLock';
import { migrateLegacyCrawlRuns } from '@/services/crawlStore';
import { forgetGa4Report, ga4ReportStorageKey } from '@/services/urlTelemetry/ga4Cache';
import { offPageHistoryKey } from '@/services/offPage/history';
import { clearProjectCache } from '@/services/llmEconomy';

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
export const forgetSubject = (projectId: string, subjectId: string): Promise<ErasureReport> => {
  invalidateQueuedCrawlWrites(projectId);
  return withCrawlWriteLock(projectId, async () => {
    await migrateLegacyCrawlRuns(projectId);
    ensureMigrationTombstone(projectId);
    const report = await invokeTauriCommand<ErasureReport>('store_forget_subject', { projectId, subjectId });
    if (typeof indexedDB !== 'undefined') await indexedDbWriteOnce(projectId, [], []);
    clearLegacyStorage(projectId);
    return report;
  });
};

const legacyKeys = (projectId: string): string[] => [
  offPageHistoryKey(projectId),
  ga4ReportStorageKey(projectId),
  `seomi_project_${projectId}_crawl_runs`,
  `seomi_project_${projectId}_crawl_result`,
  `seomi_project_${projectId}_crawl_runs_v1_backup`,
  `seomi_store_v2_migrated_${projectId}`,
  `seomi_project_${projectId}_llm_budget_v1`,
  `seomi_project_${projectId}_llm_spend_v1`,
];

const migrationKey = (projectId: string): string => `seomi_store_v2_migrated_${projectId}`;

const ensureMigrationTombstone = (projectId: string): void => {
  const key = migrationKey(projectId);
  if (readStorage(key) === '1' || writeStorage(key, '1')) return;
  throw new Error('Unable to persist the crawl history erasure marker.');
};

const clearLegacyStorage = (projectId: string): void => {
  for (const key of legacyKeys(projectId)) {
    if (readStorage(key) !== null && !removeStorage(key)) {
      throw new Error(`Unable to clear legacy crawl storage: ${key}`);
    }
  }
  forgetGa4Report(projectId);
  clearProjectCache(projectId);
};

/** Full project wipe, including leftover Web Storage migration artifacts. */
export const eraseProjectData = (projectId: string): Promise<ErasureReport> => {
  invalidateQueuedCrawlWrites(projectId);
  return withCrawlWriteLock(projectId, async () => {
    ensureMigrationTombstone(projectId);
    const report = await invokeTauriCommand<ErasureReport>('store_erase_project', { projectId });
    if (typeof indexedDB !== 'undefined') await indexedDbWriteOnce(projectId, [], []);
    clearLegacyStorage(projectId);
    return report;
  });
};

export const loadErasureLog = (projectId: string): Promise<ErasureReport[]> =>
  invokeTauriCommand<ErasureReport[]>('store_erasure_log', { projectId });
