import { z as validator } from 'zod';
import { readStorage, removeStorage, writeJsonStorage } from '@/services/storage';
import { emptyImportState, type LogImportState } from './importer';

const count = validator.number().int().nonnegative().safe();
const duration = validator.number().finite().nonnegative();
const timestamp = validator.number().int().min(-8_640_000_000_000_000).max(8_640_000_000_000_000);
const day = validator.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
});
const aggregate = validator.object({
  path: validator.string(), family: validator.enum(['googlebot', 'bingbot', 'gptbot', 'perplexitybot']),
  status: validator.enum(['verified', 'claimed', 'spoofed', 'unknown']), hits: count,
  statusGroups: validator.object({ '2xx': count, '3xx': count, '4xx': count, '5xx': count }),
  latencySumMs: duration, latencyCount: count, bytes: count,
  firstAt: timestamp, lastAt: timestamp, intervalSumMs: duration, intervalCount: count, maxIntervalMs: duration,
}).refine((value) => value.firstAt <= value.lastAt
  && Object.values(value.statusGroups).reduce((total, number) => total + number, 0) === value.hits);
const schema = validator.object({
  fileHashes: validator.array(validator.string()), inProgress: validator.object({ hash: validator.string(), offset: count }).nullable(),
  lines: count, malformed: count, ignoredNonBot: count,
  firstAt: timestamp.nullable(), lastAt: timestamp.nullable(), days: validator.array(day), aggs: validator.record(aggregate),
}).refine((value) => value.malformed + value.ignoredNonBot <= value.lines
  && ((value.firstAt === null && value.lastAt === null)
    || (value.firstAt !== null && value.lastAt !== null && value.firstAt <= value.lastAt))
  && new Set(value.days).size === value.days.length);

export const logStorageKey = (projectId: string): string => `seomi_project_${encodeURIComponent(projectId)}_log_intelligence_v1`;

export const readLogState = (projectId: string): LogImportState => {
  const key = logStorageKey(projectId);
  const raw = readStorage(key);
  if (raw === null) return emptyImportState();
  try {
    const result = schema.safeParse(JSON.parse(raw));
    if (result.success) return result.data;
  } catch {}
  removeStorage(key);
  return emptyImportState();
};

export const saveLogState = (projectId: string, state: LogImportState): boolean => writeJsonStorage(logStorageKey(projectId), state);
export const clearLogState = (projectId: string): boolean => removeStorage(logStorageKey(projectId));
