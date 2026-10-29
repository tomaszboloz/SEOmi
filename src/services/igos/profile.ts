/**
 * Threshold profile. Zone boundaries form a closed partition (see zones.ts)
 * so no similarity falls into an undefined gap (decisions IGOS-D01/D02, #83).
 */
export const IGOS_PROFILE = {
  consensusDf: 0.4,
  /** Entity is rare when 0 < DF <= rareDf (inclusive). */
  rareDf: 0.2,
  echoNearest: 0.82,
  gainTopic: 0.48,
  driftNearestBelow: 0.6,
  onTopicQuota: 0.4,
  minDocs: 3,
  weights: { nefr: 0.35, edsi: 0.3, fhem: 0.2, sdd: 0.15 },
  epsilon: 1e-9,
  /** Four measured quantities weigh as much as one DOI/PMID reference in EDSI. */
  quantityWeight: 0.25,
} as const;
