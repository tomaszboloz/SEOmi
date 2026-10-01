import type { CrawlRunRecord, SeoProject } from '@/types';
import { loadCrawlRuns, saveCrawlRuns } from '@/services/crawlPersistence';
import { readStorage, readStorageEntries, removeStorage, writeStorage } from '@/services/storage';
import i18n from '@/i18n';

export const MAX_PROJECT_BACKUP_CHARS = 25 * 1024 * 1024;

export const PROJECT_BACKUP_FORMAT = 'seomi-project-backup-v1' as const;
const PROJECT_ID_PATTERN = /^[a-zA-Z0-9-]{1,80}$/;
const projectStoragePrefix = (projectId: string): string => `seomi_project_${projectId}_`;

export interface ProjectBackup {
  format: typeof PROJECT_BACKUP_FORMAT;
  exportedAt: string;
  project: SeoProject;
  /** Values are intentionally keyed by suffix so restore can never overwrite another project. */
  localStorage: Record<string, string>;
  crawlRuns: CrawlRunRecord[];
  secretsExcluded: true;
}

export interface ProjectBackupSummary {
  storageEntries: number;
  crawlRuns: number;
  sourceProjectName: string;
}

const isProjectId = (value: unknown): value is string =>
  typeof value === 'string' && PROJECT_ID_PATTERN.test(value);

const isProject = (value: unknown): value is SeoProject => {
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

const readProjectStorage = (projectId: string): Record<string, string> => {
  const primary = readStorageEntries(projectStoragePrefix(projectId));
  const extraKeys = [
    `seomi_gsc_client_id_${projectId}`,
    `seomi_gsc_property_${projectId}`,
    `seomi_gsc_filters_${projectId}_v1`,
    `seomi_keyword_clustering_${projectId}`,
    `seomi_pagespeed_workspace_${projectId}`,
    `seomi_performance_${projectId}`,
  ];
  for (const key of extraKeys) {
    const value = readStorage(key);
    if (value !== null) primary[`__raw__${key}`] = value;
  }
  return primary;
};

const assertBackupShape = (value: unknown): ProjectBackup => {
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
    localStorageEntries[suffix] = storedValue;
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

export const restoreProjectBackup = async (backup: ProjectBackup, targetProjectId: string): Promise<ProjectBackupSummary> => {
  const validated = assertBackupShape(backup);
  if (!isProjectId(targetProjectId)) throw new Error(i18n.t('runtimeErrors.backup.target'));
  const prefix = projectStoragePrefix(targetProjectId);
  let storageEntries = 0;
  const previousValues = new Map<string, string | null>();
  const writtenKeys: string[] = [];
  try {
    for (const [suffix, value] of Object.entries(validated.localStorage)) {
      const key = suffix.startsWith('__raw__')
        ? suffix.slice('__raw__'.length).replace(validated.project.id, targetProjectId)
        : `${prefix}${suffix}`;
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
