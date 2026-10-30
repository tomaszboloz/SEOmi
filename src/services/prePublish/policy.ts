import { readJsonStorage, writeJsonStorage } from '@/services/storage';
import type { PrePublishReport } from './check';

/**
 * Advisory vs enforced pre-publish policy (#94 GEM-94-08, #95). Decision (default chosen by agent):
 * advisory by default; enforced is an explicit per-project opt-in. Neither mode publishes, deletes or
 * redirects anything. In enforced mode only a complete "ok" check for the current inputs passes; everything
 * else is held for a human decision. A stale baseline, unsupported language or missing evidence never yields
 * publishApproved=true in either mode.
 */
export type PrePublishPolicy = 'advisory' | 'enforced';
export type PrePublishGate = 'advice' | 'pass' | 'hold';
export type EvidenceGap = 'stale-baseline' | 'unsupported-language' | 'no-baseline-date';

export const BASELINE_MAX_AGE_DAYS = 30;

export interface PolicyEvidence { baselineCompletedAt: string | null; languageStatus: 'supported' | 'uncertain' | 'unsupported'; now?: Date }

export const evidenceGaps = ({ baselineCompletedAt, languageStatus, now = new Date() }: PolicyEvidence): EvidenceGap[] => {
  const gaps: EvidenceGap[] = [];
  const completed = baselineCompletedAt ? Date.parse(baselineCompletedAt) : Number.NaN;
  if (!Number.isFinite(completed)) gaps.push('no-baseline-date');
  else if ((now.getTime() - completed) / 86_400_000 > BASELINE_MAX_AGE_DAYS) gaps.push('stale-baseline');
  if (languageStatus === 'unsupported') gaps.push('unsupported-language');
  return gaps;
};

export const applyPolicy = (report: PrePublishReport, policy: PrePublishPolicy, gaps: readonly EvidenceGap[]): PrePublishReport => {
  const complete = report.verdict === 'ok' && gaps.length === 0;
  const gate: PrePublishGate = policy === 'advisory' ? 'advice' : complete ? 'pass' : 'hold';
  return { ...report, policy, gate, evidenceGaps: [...gaps], publishApproved: report.publishApproved && complete };
};

export const prePublishPolicyKey = (projectId: string): string => `seomi_project_${encodeURIComponent(projectId)}_prepublish_policy_v1`;

export const readPrePublishPolicy = (projectId: string | null): PrePublishPolicy =>
  projectId && readJsonStorage(prePublishPolicyKey(projectId), 'advisory') === 'enforced' ? 'enforced' : 'advisory';

export const savePrePublishPolicy = (projectId: string, policy: PrePublishPolicy): boolean =>
  writeJsonStorage(prePublishPolicyKey(projectId), policy);
