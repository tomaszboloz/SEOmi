import { saveCrawlRuns } from '@/services/crawlPersistence';
import { readStorage, removeStorage, writeStorage } from '@/services/storage';
import { assertBackupShape, isProjectId } from './validation';
import { restoreProjectStorageKey } from './storage';
import type { ProjectBackup, ProjectBackupSummary } from './types';
import i18n from '@/i18n';

const restoreValidatedBackup = async (validated: ProjectBackup, targetProjectId: string): Promise<ProjectBackupSummary> => {
  let storageEntries = 0;
  const previousValues = new Map<string, string | null>();
  const writtenKeys: string[] = [];
  try {
    for (const [suffix, value] of Object.entries(validated.localStorage)) {
      const key = restoreProjectStorageKey(suffix, validated.project.id, targetProjectId);
      previousValues.set(key, readStorage(key));
      if (!writeStorage(key, value)) {
        throw new Error(i18n.t('runtimeErrors.backup.restore'));
      }
      writtenKeys.push(key);
      storageEntries += 1;
    }
    await saveCrawlRuns(targetProjectId, validated.crawlRuns);
  } catch (error) {
    // Web Storage has no transaction primitive. Roll back keys written by this
    // restore so a quota or filesystem failure cannot leave a half-restored
    // project that looks complete on the next launch.
    for (const key of writtenKeys.reverse()) {
      const previous = previousValues.get(key);
      if (previous === null || previous === undefined) removeStorage(key);
      else writeStorage(key, previous);
    }
    throw error instanceof Error ? error : new Error(i18n.t('runtimeErrors.backup.restore'));
  }
  return {
    storageEntries,
    crawlRuns: validated.crawlRuns.length,
    sourceProjectName: validated.project.name,
  };
};

const restoreLocks = new Map<string, Promise<void>>();
export const restoreProjectBackup = async (backup: ProjectBackup, targetProjectId: string): Promise<ProjectBackupSummary> => {
  const validated = assertBackupShape(backup);
  if (!isProjectId(targetProjectId)) throw new Error(i18n.t('runtimeErrors.backup.target'));
  const previous = restoreLocks.get(targetProjectId) ?? Promise.resolve();
  const operation = previous.then(() => restoreValidatedBackup(validated, targetProjectId));
  const settled = operation.then(() => undefined, () => undefined);
  restoreLocks.set(targetProjectId, settled);
  try { return await operation; }
  finally { if (restoreLocks.get(targetProjectId) === settled) restoreLocks.delete(targetProjectId); }
};
