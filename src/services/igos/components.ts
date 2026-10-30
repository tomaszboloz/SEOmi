import { entityKey } from './baseline';
import { IGOS_PROFILE as P } from './profile';
import type { ConsensusBaseline, TargetDoc } from './types';

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

/**
 * NEFR = min(1, |E_novel| / max(5, .35 * |E_consensus|)). Novel = target entity that is not a consensus entity.
 * With `onTopicText`, only entities that occur in on-topic chunks count (GEM-67-06), so drift cannot inflate NEFR.
 */
export const novelEntities = (target: string[], baseline: ConsensusBaseline, onTopicText?: string): string[] => {
  const consensus = new Set(baseline.consensusEntities.map(entityKey));
  const onTopic = onTopicText === undefined ? null : entityKey(onTopicText);
  const seen = new Map<string, string>();
  target.forEach((entity) => {
    const key = entityKey(entity);
    if (key && !consensus.has(key) && (onTopic === null || onTopic.includes(key))) seen.set(key, entity.trim());
  });
  return [...seen.values()].sort();
};

export const nefr = (novelCount: number, consensusCount: number): number =>
  clamp01(novelCount / Math.max(5, 0.35 * consensusCount));

const EVIDENCE = [/\b10\.\d{4,9}\/[^\s"<>]+/gi, /\bPMID:?\s*\d{4,9}\b/gi];
/** A number with a unit of measure, e.g. `93 °C`, `12 g`, `4,5 kWh` (GEM-67-07). */
const QUANTITY = /(?<![\p{L}\p{N}.,/])\d+(?:[.,]\d+)?\s?(?:%|°[CF]|k?g|mg|km|cm|mm|m|ms|min|h|kWh|W|MB|GB|px|zł|PLN|EUR|USD|[$€£])(?![\p{L}\p{N}])/gu;

const PREFIX_PRICE = /[$€£]\s?\d+(?:[.,]\d+)?(?![\p{L}\p{N}])/gu;

export const measuredQuantities = (text: string): number => (text.match(QUANTITY)?.length ?? 0) + (text.match(PREFIX_PRICE)?.length ?? 0);

/** Evidence per 1000 words, saturating at 3: each DOI/PMID counts 1, each measured quantity counts `quantityWeight`. */
export const edsi = (text: string, wordCount: number): number => {
  const refs = EVIDENCE.reduce((sum, pattern) => sum + (text.match(pattern)?.length ?? 0), 0);
  return clamp01((refs + P.quantityWeight * measuredQuantities(text)) / Math.max(1, wordCount / 1000) / 3);
};

const FIRST_HAND = [
  /\b(?:we|i)\s+(?:tested|measured|ran|benchmarked|interviewed|surveyed|built)\b/gi,
  /\b(?:przetestowa|zmierzy|sprawdzi|zbadali|przeprowadzi)\p{L}*/giu,
  /\bin our (?:test|study|experiment|survey)s?\b/gi,
];

/** First-hand evidence markers (English and Polish only); saturates at 3 markers. */
export const fhem = (text: string): number =>
  clamp01(FIRST_HAND.reduce((sum, pattern) => sum + (text.match(pattern)?.length ?? 0), 0) / 3);

const distribution = (terms: Map<string, number>, keys: string[]): number[] => {
  const total = keys.reduce((sum, key) => sum + (terms.get(key) ?? 0), 0) + keys.length * P.epsilon;
  return keys.map((key) => ((terms.get(key) ?? 0) + P.epsilon) / total);
};

/** Jensen-Shannon divergence in nats divided by ln 2, so it is bounded in [0, 1]. */
export const sdd = (target: Map<string, number>, consensus: Map<string, number>): number => {
  const keys = [...new Set([...target.keys(), ...consensus.keys()])];
  if (!keys.length) return 0;
  const p = distribution(target, keys);
  const q = distribution(consensus, keys);
  const kl = (a: number[], b: number[]) => a.reduce((sum, value, index) => sum + value * Math.log(value / b[index]), 0);
  const mid = p.map((value, index) => (value + q[index]) / 2);
  return clamp01((kl(p, mid) + kl(q, mid)) / 2 / Math.LN2);
};

export const baseCoverage = (target: TargetDoc, baseline: ConsensusBaseline): number => {
  if (!baseline.consensusEntities.length) return 1;
  const own = new Set(target.entities.map(entityKey));
  return baseline.consensusEntities.filter((entity) => own.has(entityKey(entity))).length / baseline.consensusEntities.length;
};

/** Penalty multiplier: 1 once half of the consensus entities are covered, linear below. */
export const penalty = (coverage: number): number => Math.min(1, 0.5 + coverage);
