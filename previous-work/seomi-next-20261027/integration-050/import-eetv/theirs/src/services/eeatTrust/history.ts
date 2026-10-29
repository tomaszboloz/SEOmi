import { readJsonStorage, writeJsonStorage } from '@/services/storage';
import { validProjectId } from '@/services/schedules/policy';
import { TRUST_PROFILE_ID, TRUST_WEIGHTS, type TrustReport, type TrustSnapshot, type TrustCoverage } from './types';

export const TRUST_HISTORY_LIMIT = 50;

export const trustHistoryKey = (projectId: string): string => `seomi_project_${projectId}_eeat_trust_history_v1`;

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const clean = (raw: unknown): TrustSnapshot[] => {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item): TrustSnapshot[] => {
    if (!item || typeof item !== 'object') return [];
    const { at, runId, score, layers, profileVersion, profileId, coverage } = item as Partial<TrustSnapshot>;
    if (typeof at !== 'string' || typeof runId !== 'string' || !finite(score)) return [];
    const kept = Object.fromEntries(Object.keys(TRUST_WEIGHTS).flatMap((layer) => {
      const value = (layers as Record<string, unknown> | undefined)?.[layer];
      return finite(value) ? [[layer, value]] : [];
    }));
    const modern = profileVersion === 2 || profileId === TRUST_PROFILE_ID;
    const cleanCoverage = modern && coverage && typeof coverage === 'object'
      ? Object.fromEntries(Object.keys(TRUST_WEIGHTS).flatMap((layer) => {
        const value = (coverage as Record<string, unknown>)[layer];
        if (!value || typeof value !== 'object') return [];
        const item = value as Partial<TrustCoverage>;
        return ['observed', 'declared', 'verified', 'unknown'].every((key) => finite(item[key as keyof TrustCoverage]))
          ? [[layer, item]] : [];
      })) : undefined;
    return modern
      ? [{ at, runId, score, layers: kept, profileVersion: 2, profileId: TRUST_PROFILE_ID, ...(cleanCoverage ? { coverage: cleanCoverage } : {}) }]
      : [{ at, runId, score, layers: kept }];
  });
};

export const readTrustHistory = (projectId: string | null | undefined): TrustSnapshot[] => (
  projectId && validProjectId(projectId) ? clean(readJsonStorage(trustHistoryKey(projectId), [])) : []
);

/** Historical scores are comparable only inside the same explicit profile. */
export const comparableTrustSnapshots = (left: TrustSnapshot | undefined, right: TrustSnapshot | undefined): boolean => {
  if (!left || !right) return false;
  const profile = (item: TrustSnapshot) => item.profileId ?? (item.profileVersion === 2 ? TRUST_PROFILE_ID : 'eetv-4-layer-v1');
  return profile(left) === profile(right);
};

/** Appends one snapshot per run (a repeat for the same run replaces it); keeps the newest TRUST_HISTORY_LIMIT. */
export const recordTrust = (projectId: string | null | undefined, report: TrustReport, runId: string): TrustSnapshot[] => {
  if (!projectId || !validProjectId(projectId)) return [];
  const snapshot: TrustSnapshot = { at: report.generatedAt, runId, score: report.score, layers: report.layers, profileVersion: report.profileVersion, profileId: report.profileId, coverage: report.coverage };
  const history = [...readTrustHistory(projectId).filter((item) => item.runId !== runId), snapshot].slice(-TRUST_HISTORY_LIMIT);
  return writeJsonStorage(trustHistoryKey(projectId), history) ? history : readTrustHistory(projectId);
};
