import { DEFAULT_MATRIX } from '@/services/logIntelligence/matrix';
import { SFS_BANDS, SFS_TRS_SCALE } from '@/services/siteFocus/profile';
import { PRE_PUBLISH_COSINE, SAME_INTENT_COSINE } from '@/services/topicalAuthority/cannibal';
import { DEFAULT_PRI_THRESHOLD, DEFAULT_TRS_THRESHOLD } from '@/services/urlProtection/decide';
import { DEFAULT_PRI_PARAMS } from '@/services/urlProtection/pri';

export type DecisionStatus = 'proposed' | 'accepted';
export type CodeValue = number | string | boolean;

/**
 * One divergence between the Gemini description and the shipped code (#83 GEM-83-02..15). `code` holds
 * the constants the app uses today, read from the modules themselves so this register cannot drift from
 * them. A decision becomes `accepted` only when a person resolves it: then author, date and the chosen
 * variant are required. Nothing here changes a score; a new value ships as a new profile version.
 */
export interface ProfileDecision {
  id: string;
  issue: number;
  sourceSection: string;
  described: string;
  code: Record<string, CodeValue>;
  status: DecisionStatus;
  chosen?: 'described' | 'code' | 'other';
  author?: string;
  decidedAt?: string;
  rationale?: string;
}

const proposed = (id: string, issue: number, sourceSection: string, described: string, code: Record<string, CodeValue> = {}): ProfileDecision =>
  ({ id, issue, sourceSection, described, code, status: 'proposed' });

/** Every divergence named in #83, all `proposed` until a person accepts one (GEM-83-15). */
export const PROFILE_DECISIONS: readonly ProfileDecision[] = [
  proposed('D-SFS', 52, 'SFS TRS scale and bands', 'TRS x125, bands 90/75/60/40; calibrate on real crawls',
    { trsScale: SFS_TRS_SCALE, excellent: SFS_BANDS.excellent, good: SFS_BANDS.good, moderate: SFS_BANDS.moderate, weak: SFS_BANDS.weak }),
  proposed('D-PRI', 81, 'URL protection guardrail', 'TRS < 40 and PRI < .15 (description) vs TRS < 60 (older code)', {
    trsThreshold: DEFAULT_TRS_THRESHOLD, priThreshold: DEFAULT_PRI_THRESHOLD, clicks: DEFAULT_PRI_PARAMS.clicksThreshold,
    conversions: DEFAULT_PRI_PARAMS.conversionsThreshold, domains: DEFAULT_PRI_PARAMS.domainsThreshold, tiesProtect: true,
  }),
  proposed('D-LOG', 92, 'Crawl budget matrix', 'starvation < 1 hit in 14 days (description) vs < 2 in 30 days (code); waste TRS 45 / 25 hits', {
    windowDays: DEFAULT_MATRIX.windowDays, starvationMaxHits: DEFAULT_MATRIX.starvationMaxHits, wasteMaxTrs: DEFAULT_MATRIX.wasteMaxTrs, wasteMinHits: DEFAULT_MATRIX.wasteMinHits,
  }),
  proposed('D-DRAFT', 94, 'Pre-publish cannibalization', 'similarity .85/.86/.88 and donors .65-.84 (description) vs code', { prePublishCosine: PRE_PUBLISH_COSINE, sameIntentCosine: SAME_INTENT_COSINE }),
  proposed('D-TAS', 57, 'Topical authority', 'I_j, connectivity, orphan, bleed and freshness weights; partial renormalisation'),
  proposed('D-AIO', 63, 'AIO readiness', '300 max / 180 target / 30 answer-first words'),
  proposed('D-IGOS', 67, 'Information gain', 'NEFR .35 vs .40, ChunkGain, JS/KL divergence'),
  proposed('D-EETV', 65, 'E-E-A-T trust', '4-layer .60/.40 vs .55/.45 plus reviewer penalty .65; R_backed weights and YMYL'),
  proposed('D-SIJA', 72, 'Search intent alignment', 'SSAS mismatch < 50 vs < 55; LOCAL / TOFU / MOFU'),
  proposed('D-SPRS', 71, 'Semantic PageRank', 'similarity floor .05 in code, absent from description; raw to score normalisation'),
  proposed('D-HSS', 83, 'Holistic site score', 'minimal coverage and domain/page aggregation; no undescribed formulas'),
];

export type DecisionProblem = 'accepted-without-author' | 'accepted-without-date' | 'accepted-without-choice' | 'proposed-with-author';

/** Checks the register rules; an empty list means the entry is valid. */
export const decisionProblems = (decision: ProfileDecision): DecisionProblem[] => {
  const problems: DecisionProblem[] = [];
  if (decision.status === 'accepted') {
    if (!decision.author?.trim()) problems.push('accepted-without-author');
    if (!decision.decidedAt || Number.isNaN(Date.parse(decision.decidedAt))) problems.push('accepted-without-date');
    if (!decision.chosen) problems.push('accepted-without-choice');
  } else if (decision.author || decision.decidedAt) problems.push('proposed-with-author');
  return problems;
};
