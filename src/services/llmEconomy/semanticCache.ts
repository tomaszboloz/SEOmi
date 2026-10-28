import { cosine, normalize } from '@/services/embeddings/vector';
import {
  CACHE_TTL_MS, MAX_PROJECT_TASKS, clearAllCacheData, clearProjectCacheData, loadProject, persistProject,
  projectCacheSize, type TaskRecord,
} from './cacheStore';
export { CACHE_TTL_MS, MAX_PROJECT_TASKS } from './cacheStore';

export interface CacheEntry {
  vector: ArrayLike<number>;
  response: string;
  costUsd: number;
}
export interface CacheHit { entry: CacheEntry; similarity: number }

export type { TaskRecord } from './cacheStore';

export interface TaskHit {
  record: TaskRecord;
  matchType: 'exact' | 'semantic';
  similarity: number;
}

export interface ExactTaskEntry { response: string; costUsd: number; at: number }

export const DEFAULT_CACHE_THRESHOLD = 0.95;
const norm = (s: string) => s.trim().toLowerCase();

export const buildTaskKey = (providerId: string, model: string, prompt: string): string =>
  `${norm(providerId)}\u0000${norm(model)}\u0000${prompt.trim()}`;

export const findProjectCachedTask = (
  projectId: string,
  model: string,
  prompt: string,
  queryVector?: ArrayLike<number> | null,
  threshold = DEFAULT_CACHE_THRESHOLD,
  providerId?: string,
  now = Date.now(),
): TaskHit | null => {
  const records = loadProject(projectId, now);
  const normalizedModel = norm(model);
  const normalizedProvider = providerId === undefined ? null : norm(providerId);
  const trimmedPrompt = prompt.trim();

  // 1. Exact prompt repetition within project & model (zero outside calls)
  const exact = records.find((r) => norm(r.model) === normalizedModel
    && (normalizedProvider === null || norm(r.providerId) === normalizedProvider)
    && r.prompt.trim() === trimmedPrompt);
  if (exact) return { record: exact, matchType: 'exact', similarity: 1.0 };

  // 2. Cosine semantic matching when query vector is provided (unavailable if absent)
  if (!queryVector || queryVector.length === 0) return null;
  const normalizedQuery = normalize(queryVector);
  let best: TaskRecord | null = null;
  let bestSimilarity = -1;

  for (const r of records) {
    if (norm(r.model) !== normalizedModel
      || (normalizedProvider !== null && norm(r.providerId) !== normalizedProvider)
      || !r.vector || r.vector.length !== queryVector.length) continue;
    const sim = cosine(normalizedQuery, normalize(r.vector));
    if (sim >= threshold && sim > bestSimilarity) {
      best = r;
      bestSimilarity = sim;
    }
  }
  return best ? { record: best, matchType: 'semantic', similarity: bestSimilarity } : null;
};

export const storeProjectTask = (
  projectId: string,
  providerId: string,
  model: string,
  prompt: string,
  response: string,
  costUsd: number | null,
  vector?: ArrayLike<number> | null,
  now = Date.now(),
): TaskRecord => {
  const record: TaskRecord = {
    projectId, providerId, model, prompt, response, costUsd,
    vector: vector && vector.length > 0 ? vector : undefined, at: now,
  };
  const list = loadProject(projectId, now);
  const next = [...list, record].filter((item) => now - item.at <= CACHE_TTL_MS).slice(-MAX_PROJECT_TASKS);
  // Keep the bounded in-memory index in sync with its persisted representation.
  list.splice(0, list.length, ...next);
  persistProject(projectId, next);
  return record;
};

export const findExactCached = (key: string): ExactTaskEntry | null => {
  const parts = key.split('\u0000');
  const providerId = parts.length >= 3 ? parts[0] ?? '' : undefined;
  const hit = findProjectCachedTask('default', parts[1] ?? '', parts.slice(2).join('\u0000') || key, undefined, DEFAULT_CACHE_THRESHOLD, providerId);
  return hit ? { response: hit.record.response, costUsd: hit.record.costUsd ?? 0, at: hit.record.at } : null;
};

export const putExactCached = (key: string, response: string, costUsd: number, now = Date.now()): ExactTaskEntry => {
  const parts = key.split('\u0000');
  storeProjectTask('default', parts[0] ?? '', parts[1] ?? '', parts.slice(2).join('\u0000') || key, response, costUsd, undefined, now);
  return { response, costUsd, at: now };
};

export const clearProjectCache = (projectId: string): void => {
  clearProjectCacheData(projectId);
};
export const clearExactCache = (): void => { clearAllCacheData(); };
export const exactCacheSize = (projectId?: string): number =>
  projectCacheSize(projectId);

export const resolveCacheSavings = (normalCostUsd: number | null): { costUsd: 0; savedUsd: number; cached: true } => ({
  costUsd: 0,
  savedUsd: normalCostUsd !== null && Number.isFinite(normalCostUsd) ? Math.max(0, normalCostUsd) : 0,
  cached: true,
});

export const findCached = (
  task: ArrayLike<number>,
  history: CacheEntry[],
  threshold = DEFAULT_CACHE_THRESHOLD,
): CacheHit | null => {
  const query = normalize(task);
  let best: CacheHit | null = null;
  for (const entry of history) {
    if (entry.vector.length !== query.length) continue;
    const similarity = cosine(query, normalize(entry.vector));
    if (similarity >= threshold && (!best || similarity > best.similarity)) best = { entry, similarity };
  }
  return best;
};
