import type { SeoProject } from '@/types';
import { loadCrawlRuns } from '@/services/crawlPersistence';
import { readProjectStorage } from './storage';
import { isProject, assertBackupShape } from './validation';
import { PROJECT_BACKUP_FORMAT, MAX_PROJECT_BACKUP_CHARS, type ProjectBackup } from './types';
import i18n from '@/i18n';

export const createProjectBackup = async (project: SeoProject): Promise<ProjectBackup> => {
  if (!isProject(project)) throw new Error(i18n.t('runtimeErrors.backup.create'));
  return {
    format: PROJECT_BACKUP_FORMAT,
    exportedAt: new Date().toISOString(),
    project: { ...project },
    localStorage: readProjectStorage(project.id),
    crawlRuns: await loadCrawlRuns(project.id),
    secretsExcluded: true,
  };
};

export const serializeProjectBackup = (backup: ProjectBackup): string =>
  `${JSON.stringify(backup, null, 2)}\n`;

export const parseProjectBackup = (serialized: string): ProjectBackup => {
  if (typeof serialized !== 'string' || serialized.length === 0) throw new Error(i18n.t('runtimeErrors.backup.empty'));
  if (serialized.length > MAX_PROJECT_BACKUP_CHARS) throw new Error(i18n.t('runtimeErrors.backup.tooLarge'));
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new Error(i18n.t('runtimeErrors.backup.json'));
  }
  return assertBackupShape(parsed);
};

