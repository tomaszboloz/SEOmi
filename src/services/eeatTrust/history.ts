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
    const { at, runId, score, layers, profileVersion, profileId, scoringProfile, coverage } = item as Partial<TrustSnapshot>;
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
      ? [{ at, runId, score, layers: kept, profileVersion: 2, profileId: TRUST_PROFILE_ID, ...(scoringProfile === 'claim-backed-v1' ? { scoringProfile } : {}), ...(cleanCoverage ? { coverage: cleanCoverage } : {}) }]
      : [{ at, runId, score, layers: kept }];
  });
};

export const readTrustHistory = (projectId: string | null | undefined): TrustSnapshot[] => (
  projectId && validProjectId(projectId) ? clean(readJsonStorage(trustHistoryKey(projectId), [])) : []
);

/** Only the non-default scoring profile is stored, so legacy snapshots keep their exact shape. */
export const scoringField = (report: TrustReport): Pick<TrustSnapshot, 'scoringProfile'> => (report.scoringProfile === 'claim-backed-v1' ? { scoringProfile: report.scoringProfile } : {});

/** Historical scores are comparable only inside the same explicit profile. */
export const comparableTrustSnapshots = (left: TrustSnapshot | undefined, right: TrustSnapshot | undefined): boolean => {
  if (!left || !right) return false;
  const profile = (item: TrustSnapshot) => item.profileId ?? (item.profileVersion === 2 ? TRUST_PROFILE_ID : 'eetv-4-layer-v1');
  const scoring = (item: TrustSnapshot) => item.scoringProfile ?? 'legacy';
  return profile(left) === profile(right) && scoring(left) === scoring(right);
};

/** Whether a snapshot contains an explicit positive verification observation. */
export const hasVerifiedTrustEvidence = (item: Pick<TrustSnapshot, 'coverage'>): boolean =>
  Object.values(item.coverage ?? {}).some((layer) => Boolean(layer && finite(layer.verified) && layer.verified > 0));

/**
 * Appends one snapshot per run. A verified snapshot is an immutable baseline:
 * a later remount without the ephemeral profile evidence must not replace it
 * with a weaker, source-free observation for the same run.
 */
export const recordTrust = (projectId: string | null | undefined, report: TrustReport, runId: string): TrustSnapshot[] => {
  if (!projectId || !validProjectId(projectId)) return [];
  const available = readTrustHistory(projectId);
  if (report.availability === 'unavailable' || report.score === null || !finite(report.score)) return available;
  const snapshot: TrustSnapshot = { at: report.generatedAt, runId, score: report.score, layers: report.layers, profileVersion: report.profileVersion, profileId: report.profileId, ...scoringField(report), coverage: report.coverage };
  const current = readTrustHistory(projectId);
  const existing = current.find((item) => item.runId === runId);
  const next = existing && hasVerifiedTrustEvidence(existing) && !hasVerifiedTrustEvidence(snapshot) ? existing : snapshot;
  const history = [...current.filter((item) => item.runId !== runId), next].slice(-TRUST_HISTORY_LIMIT);
  return writeJsonStorage(trustHistoryKey(projectId), history) ? history : readTrustHistory(projectId);
};
