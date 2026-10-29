import { readJsonStorage, writeJsonStorage } from '@/services/storage';
import { validProjectId } from '@/services/schedules/policy';
import { TRUST_WEIGHTS, type TrustReport, type TrustSnapshot } from './types';

export const TRUST_HISTORY_LIMIT = 50;

export const trustHistoryKey = (projectId: string): string => `seomi_project_${projectId}_eeat_trust_history_v1`;

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const clean = (raw: unknown): TrustSnapshot[] => {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item): TrustSnapshot[] => {
    if (!item || typeof item !== 'object') return [];
    const { at, runId, score, layers } = item as Partial<TrustSnapshot>;
    if (typeof at !== 'string' || typeof runId !== 'string' || !finite(score)) return [];
    const kept = Object.fromEntries(Object.keys(TRUST_WEIGHTS).flatMap((layer) => {
      const value = (layers as Record<string, unknown> | undefined)?.[layer];
      return finite(value) ? [[layer, value]] : [];
    }));
    return [{ at, runId, score, layers: kept }];
  });
};

export const readTrustHistory = (projectId: string | null | undefined): TrustSnapshot[] => (
  projectId && validProjectId(projectId) ? clean(readJsonStorage(trustHistoryKey(projectId), [])) : []
);

/** Appends one snapshot per run (a repeat for the same run replaces it); keeps the newest TRUST_HISTORY_LIMIT. */
export const recordTrust = (projectId: string | null | undefined, report: TrustReport, runId: string): TrustSnapshot[] => {
  if (!projectId || !validProjectId(projectId)) return [];
  const snapshot: TrustSnapshot = { at: report.generatedAt, runId, score: report.score, layers: report.layers };
  const history = [...readTrustHistory(projectId).filter((item) => item.runId !== runId), snapshot].slice(-TRUST_HISTORY_LIMIT);
  return writeJsonStorage(trustHistoryKey(projectId), history) ? history : readTrustHistory(projectId);
};
