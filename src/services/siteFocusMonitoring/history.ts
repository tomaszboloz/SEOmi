import { readJsonStorage, writeJsonStorage } from '@/services/storage';
import type { HistoryAnnotation, SfsSnapshot } from '@/services/siteFocus';
import { focusHistoryKey, SFS_FULL_PAGES_KEPT, SFS_HISTORY_LIMIT, validFocusProject } from './keys';

export interface FocusHistoryEntry { snapshot: SfsSnapshot; annotations: HistoryAnnotation[] }

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const validEntry = (value: unknown): value is FocusHistoryEntry => {
  if (!isRecord(value) || !Array.isArray(value.annotations) || !isRecord(value.snapshot)) return false;
  const snapshot = value.snapshot;
  return typeof snapshot.runId === 'string' && typeof snapshot.at === 'string' && typeof snapshot.score === 'number'
    && isRecord(snapshot.coreTopic) && Array.isArray(snapshot.clusterLabels) && isRecord(snapshot.pages);
};

export const readFocusHistory = (projectId: string | null | undefined): FocusHistoryEntry[] => {
  if (!validFocusProject(projectId)) return [];
  const raw = readJsonStorage(focusHistoryKey(projectId), []);
  return (Array.isArray(raw) ? raw.filter(validEntry) : []).slice(-SFS_HISTORY_LIMIT);
};

/** Appends one entry (deduplicated by runId), trims old page maps and enforces the cap. */
export const appendFocusHistory = (projectId: string, entry: FocusHistoryEntry): { saved: boolean; entries: FocusHistoryEntry[] } => {
  const current = readFocusHistory(projectId);
  if (current.some((item) => item.snapshot.runId === entry.snapshot.runId)) return { saved: false, entries: current };
  const entries = [...current, entry].slice(-SFS_HISTORY_LIMIT).map((item, index, all) => (
    index < all.length - SFS_FULL_PAGES_KEPT && Object.keys(item.snapshot.pages).length
      ? { ...item, snapshot: { ...item.snapshot, pages: {} } } : item));
  return { saved: writeJsonStorage(focusHistoryKey(projectId), entries), entries };
};

export const annotationsByRun = (entries: FocusHistoryEntry[]): Record<string, HistoryAnnotation[]> =>
  Object.fromEntries(entries.map((entry) => [entry.snapshot.runId, entry.annotations]));
