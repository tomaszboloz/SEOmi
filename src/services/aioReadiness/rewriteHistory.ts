import { validProjectId } from '@/services/schedules/policy';
import { readJsonStorage, writeJsonStorage } from '@/services/storage';
import type { RewriteComparison } from './rewriteReview';

export const REWRITE_HISTORY_LIMIT = 100;

export interface RewriteHistoryEntry {
  revision: string;
  at: string;
  before: number | null;
  after: number | null;
  delta: number | null;
  profileId: string;
  algorithmVersion: string;
  configHash: string;
}

export const rewriteHistoryKey = (projectId: string): string => `seomi_project_${projectId}_aio_rewrite_history_v1`;

const isEntry = (value: unknown): value is RewriteHistoryEntry => {
  const item = value as Partial<RewriteHistoryEntry> | null;
  return Boolean(item) && typeof item?.revision === 'string' && typeof item.at === 'string' && typeof item.configHash === 'string';
};

export const readRewriteHistory = (projectId: string | null | undefined): RewriteHistoryEntry[] => {
  if (!projectId || !validProjectId(projectId)) return [];
  const raw = readJsonStorage(rewriteHistoryKey(projectId), []);
  return (Array.isArray(raw) ? raw.filter(isEntry) : []).slice(-REWRITE_HISTORY_LIMIT);
};

export const makeRewriteEntry = (revision: string, review: RewriteComparison, at = new Date().toISOString()): RewriteHistoryEntry => ({
  revision, at, before: review.before.score, after: review.after.score, delta: review.delta,
  profileId: review.before.profile.id, algorithmVersion: review.before.profile.algorithmVersion, configHash: review.before.profile.configHash,
});

export const recordRewrite = (projectId: string | null | undefined, entry: RewriteHistoryEntry): RewriteHistoryEntry[] => {
  if (!projectId || !validProjectId(projectId)) return [];
  const next = [...readRewriteHistory(projectId), entry].slice(-REWRITE_HISTORY_LIMIT);
  writeJsonStorage(rewriteHistoryKey(projectId), next);
  return next;
};

/** Only entries scored by the same profile config are comparable; the others are counted separately, never mixed. */
export const comparableRewrites = (history: RewriteHistoryEntry[], revision: string, configHash: string): { comparable: RewriteHistoryEntry[]; other: number } => {
  const same = history.filter((item) => item.revision === revision);
  const comparable = same.filter((item) => item.configHash === configHash);
  return { comparable, other: same.length - comparable.length };
};
