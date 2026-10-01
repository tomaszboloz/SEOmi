import type { CrawlRunRecord, SeoProject } from '@/types';

export const MAX_PROJECT_BACKUP_CHARS = 25 * 1024 * 1024;

export const PROJECT_BACKUP_FORMAT = 'seomi-project-backup-v1' as const;

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

