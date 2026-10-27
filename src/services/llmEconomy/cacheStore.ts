import { readStorage, removeStorage, writeStorage } from '@/services/storage';

export interface TaskRecord {
  projectId: string;
  providerId: string;
  model: string;
  prompt: string;
  vector?: ArrayLike<number>;
  response: string;
  costUsd: number | null;
  at: number;
}

export const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
export const MAX_PROJECT_TASKS = 100;
const CACHE_KEY_SUFFIX = '_llm_cache_v1';
const MAX_CACHE_TEXT = 100_000;
const MAX_CACHE_VECTOR = 2048;
const MAX_CACHE_BYTES = 2_000_000;
const memory = new Map<string, TaskRecord[]>();
const loaded = new Set<string>();
const known = new Set<string>();

const keyFor = (projectId: string): string => `seomi_project_${projectId}${CACHE_KEY_SUFFIX}`;
const prune = (records: TaskRecord[], now: number): TaskRecord[] => records
  .filter((record) => now - record.at <= CACHE_TTL_MS).slice(-MAX_PROJECT_TASKS);

const validRecord = (projectId: string, value: unknown): value is TaskRecord => {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<TaskRecord>;
  return item.projectId === projectId && typeof item.providerId === 'string' && typeof item.model === 'string'
    && typeof item.prompt === 'string' && item.prompt.length <= MAX_CACHE_TEXT
    && typeof item.response === 'string' && item.response.length <= MAX_CACHE_TEXT
    && (item.costUsd === null || (typeof item.costUsd === 'number' && Number.isFinite(item.costUsd) && item.costUsd >= 0))
    && typeof item.at === 'number' && Number.isFinite(item.at)
    && (item.vector === undefined || (Array.isArray(item.vector) && item.vector.length <= MAX_CACHE_VECTOR
      && item.vector.every((entry) => typeof entry === 'number' && Number.isFinite(entry))));
};

export const loadProject = (projectId: string, now: number): TaskRecord[] => {
  known.add(projectId);
  if (loaded.has(projectId)) return memory.get(projectId) ?? [];
  loaded.add(projectId);
  const raw = readStorage(keyFor(projectId));
  if (raw === null) { const empty: TaskRecord[] = []; memory.set(projectId, empty); return empty; }
  try {
    if (raw.length > MAX_CACHE_BYTES) throw new Error('cache payload exceeds bound');
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('cache record must be an array');
    const records = parsed.filter((item): item is TaskRecord => validRecord(projectId, item));
    const pruned = prune(records, now);
    memory.set(projectId, pruned);
    return pruned;
  } catch {
    const empty: TaskRecord[] = [];
    memory.set(projectId, empty);
    return empty;
  }
};

export const persistProject = (projectId: string, records: TaskRecord[]): void => {
  try { writeStorage(keyFor(projectId), JSON.stringify(records.slice(-MAX_PROJECT_TASKS))); } catch { /* volatile fallback */ }
};

export const clearProjectCacheData = (projectId: string): void => {
  memory.delete(projectId); loaded.delete(projectId); known.delete(projectId); removeStorage(keyFor(projectId));
};
export const clearAllCacheData = (): void => {
  for (const projectId of known) removeStorage(keyFor(projectId));
  memory.clear(); loaded.clear(); known.clear();
};
export const projectCacheSize = (projectId?: string): number => projectId
  ? (memory.get(projectId)?.length ?? 0)
  : Array.from(memory.values()).reduce((sum, records) => sum + records.length, 0);
