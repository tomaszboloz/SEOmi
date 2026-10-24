import { z } from 'zod';
import { readJsonStorage, writeJsonStorage } from '@/services/storage';
import { serializeSerpSnapshot, serpSnapshotSchema, snapshotTimestamp } from './snapshotSchema';
import type { SerpSnapshot } from './types';

export type SerpContext = Pick<SerpSnapshot, 'query' | 'country' | 'language'>;
export interface SerpHistory { snapshots: SerpSnapshot[]; lastAlertAt: string | null }
export const SERP_HISTORY_EVENT = 'seomi:serp-history';
export const MAX_SERP_HISTORY = 24;
export const decayStorageKey = (projectId: string) => `seomi_project_${projectId}_serp_decay_v1`;
const normalize = (value: string) => value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
export const serpContextKey = (context: SerpContext) => JSON.stringify([context.query, context.country, context.language].map(normalize));
const recordSchema = z.record(z.string(), z.unknown());
const historySchema = z.object({ snapshots: z.array(z.unknown()), lastAlertAt: snapshotTimestamp.nullable().catch(null) });
const empty = (): SerpHistory => ({ snapshots: [], lastAlertAt: null });

export const readSerpHistories = (projectId: string | null): Record<string, SerpHistory> => {
  if (!projectId) return {};
  const record = recordSchema.safeParse(readJsonStorage(decayStorageKey(projectId), {}));
  if (!record.success) return {};
  return Object.fromEntries(Object.entries(record.data).flatMap(([key, value]) => {
    const history = historySchema.safeParse(value);
    if (!history.success) return [];
    const snapshots = history.data.snapshots.flatMap((raw) => {
      const parsed = serpSnapshotSchema.safeParse(raw);
      return parsed.success && serpContextKey(parsed.data) === key ? [parsed.data] : [];
    });
    const unique = [...new Map(snapshots.map((snapshot) => [snapshot.id, snapshot])).values()];
    unique.sort((left, right) => Date.parse(left.takenAt) - Date.parse(right.takenAt));
    return [[key, { snapshots: unique.slice(-MAX_SERP_HISTORY), lastAlertAt: history.data.lastAlertAt }]];
  }));
};

const save = (projectId: string, histories: Record<string, SerpHistory>) => writeJsonStorage(
  decayStorageKey(projectId), Object.fromEntries(Object.entries(histories).map(([key, history]) => [
    key, { ...history, snapshots: history.snapshots.map(serializeSerpSnapshot) },
  ])),
);

export const appendSerpSnapshot = (projectId: string | null, snapshot: SerpSnapshot): boolean => {
  if (!projectId) return false;
  const parsed = serpSnapshotSchema.safeParse(serializeSerpSnapshot(snapshot));
  if (!parsed.success) return false;
  const histories = readSerpHistories(projectId);
  const key = serpContextKey(parsed.data);
  const history = histories[key] ?? empty();
  if (history.snapshots.some((entry) => entry.id === parsed.data.id)) return false;
  const snapshots = [...history.snapshots, parsed.data].sort((left, right) => Date.parse(left.takenAt) - Date.parse(right.takenAt));
  histories[key] = { ...history, snapshots: snapshots.slice(-MAX_SERP_HISTORY) };
  const saved = save(projectId, histories);
  if (saved && typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(SERP_HISTORY_EVENT, { detail: decayStorageKey(projectId) }));
  return saved;
};

export const loadSerpHistory = (projectId: string | null, context?: SerpContext): SerpHistory => {
  const histories = readSerpHistories(projectId);
  if (context) return histories[serpContextKey(context)] ?? empty();
  const available = Object.values(histories).filter((history) => history.snapshots.length);
  const comparable = available.filter((history) => history.snapshots.length >= 2);
  const recent = (comparable.length ? comparable : available).sort((left, right) =>
    Date.parse(right.snapshots[right.snapshots.length - 1].takenAt) - Date.parse(left.snapshots[left.snapshots.length - 1].takenAt));
  return recent[0] ?? empty();
};

export const markSerpAlert = (projectId: string | null, context: SerpContext, timestamp: string): boolean => {
  if (!projectId || !snapshotTimestamp.safeParse(timestamp).success) return false;
  const histories = readSerpHistories(projectId);
  const key = serpContextKey(context);
  if (!histories[key]?.snapshots.length) return false;
  histories[key].lastAlertAt = timestamp;
  return save(projectId, histories);
};
