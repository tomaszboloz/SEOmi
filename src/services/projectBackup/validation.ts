import type { CrawlRunRecord, SeoProject } from '@/types';
import type { ProjectBackup } from './types';
import { PROJECT_BACKUP_FORMAT } from './types';
import { restoreProjectStorageKey } from './storage';
import i18n from '@/i18n';
const PROJECT_ID_PATTERN = /^[a-zA-Z0-9-]{1,80}$/;

export const isProjectId = (value: unknown): value is string =>
  typeof value === 'string' && PROJECT_ID_PATTERN.test(value);

export const isProject = (value: unknown): value is SeoProject => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<SeoProject>;
  return isProjectId(candidate.id)
    && typeof candidate.name === 'string'
    && candidate.name.trim().length > 0
    && candidate.name.length <= 120
    && typeof candidate.createdAt === 'string'
    && typeof candidate.lastOpenedAt === 'string'
    && (candidate.rootUrl === undefined || typeof candidate.rootUrl === 'string');
};

export const assertBackupShape = (value: unknown): ProjectBackup => {
  if (!value || typeof value !== 'object') throw new Error(i18n.t('runtimeErrors.backup.missingProject'));
  const candidate = value as Partial<ProjectBackup>;
  if (candidate.format !== PROJECT_BACKUP_FORMAT) throw new Error(i18n.t('runtimeErrors.backup.format'));
  if (candidate.secretsExcluded !== true) throw new Error(i18n.t('runtimeErrors.backup.secrets'));
  if (!isProject(candidate.project)) throw new Error(i18n.t('runtimeErrors.backup.projectMeta'));
  if (typeof candidate.exportedAt !== 'string' || Number.isNaN(Date.parse(candidate.exportedAt))) {
    throw new Error(i18n.t('runtimeErrors.backup.date'));
  }
  if (!candidate.localStorage || typeof candidate.localStorage !== 'object' || Array.isArray(candidate.localStorage)) {
    throw new Error(i18n.t('runtimeErrors.backup.workspace'));
  }
  const localStorageEntries: Record<string, string> = {};
  for (const [suffix, storedValue] of Object.entries(candidate.localStorage)) {
    if (suffix.length > 4096 || typeof storedValue !== 'string' || suffix.includes('\u0000')) {
      throw new Error(i18n.t('runtimeErrors.backup.entry'));
    }
    restoreProjectStorageKey(suffix, candidate.project.id, candidate.project.id);
    Object.defineProperty(localStorageEntries, suffix, { value: storedValue, enumerable: true, configurable: true, writable: true });
  }
  if (!Array.isArray(candidate.crawlRuns) || candidate.crawlRuns.some((run) => !run || typeof run !== 'object')) {
    throw new Error(i18n.t('runtimeErrors.backup.crawl'));
  }
  return {
    format: PROJECT_BACKUP_FORMAT,
    exportedAt: candidate.exportedAt,
    project: candidate.project,
    localStorage: localStorageEntries,
    crawlRuns: candidate.crawlRuns as CrawlRunRecord[],
    secretsExcluded: true,
  };
};

