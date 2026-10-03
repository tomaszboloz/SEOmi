import { z } from 'zod';
import { readJsonRecord, parseRecordEntries } from '@/services/storageContracts';

export interface DirectoryPreferences {
  query: string;
  expanded: Record<string, boolean>;
  visibleCounts: Record<string, number>;
  selectedUrl: string | null;
}

export const PAGE_SIZE = 100;
export const emptyPreferences = (): DirectoryPreferences => ({ query: '', expanded: {}, visibleCounts: {}, selectedUrl: null });
export const preferenceKey = (projectId: string | null, runId: string) => projectId
  ? `seomi_project_${projectId}_crawl_directory_${runId}_v1`
  : null;

export const readPreferences = (key: string | null): DirectoryPreferences => {
  if (!key) return emptyPreferences();
  try {
    const parsed = readJsonRecord(key);
    const expanded = Object.fromEntries(Object.entries(parseRecordEntries(parsed.expanded, z.boolean()))
      .filter(([id, value]) => id.length <= 2048 && typeof value === 'boolean')
      .slice(-500));
    const visibleCounts = Object.fromEntries(Object.entries(parseRecordEntries(parsed.visibleCounts, z.number().int().min(PAGE_SIZE)))
      .filter(([id, value]) => id.length <= 2060 && Number.isSafeInteger(value) && Number(value) >= PAGE_SIZE)
      .map(([id, value]) => [id, Math.min(Number(value), 1_000_000)])
      .slice(-500));
    return {
      query: typeof parsed.query === 'string' ? parsed.query.slice(0, 200) : '',
      expanded,
      visibleCounts,
      selectedUrl: typeof parsed.selectedUrl === 'string' ? parsed.selectedUrl.slice(0, 2048) : null,
    };
  } catch {
    return emptyPreferences();
  }
};

