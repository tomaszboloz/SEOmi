import {
  isFullScoreEligible, sameSerpContext, MAX_SERP_URL_LENGTH, TOP10_MAX_RESULTS,
  MAX_SERP_KEYWORD_LENGTH, type SerpSnapshot, type SerpSource,
} from '../serpImport/contracts.ts';

export const MAX_HYBRID_VECTOR_DIMENSIONS = 4096;
export const MAX_HYBRID_KEYWORDS = 200;
export interface HybridWeights { semantic: number; serp: number }
export interface HybridKeywordInput { keyword: string; vector: ArrayLike<number>; snapshot?: SerpSnapshot | null }
export interface HybridEvidence {
  keywordA: string; keywordB: string; semanticCosine: number; serpJaccard: number | null; score: number;
  mode: 'hybrid' | 'semantic-only'; sharedUrls: string[]; sourceA: SerpSource | null; sourceB: SerpSource | null;
  weights: HybridWeights; appliedWeights: HybridWeights; reasons: string[];
}

const finite = (value: number): boolean => Number.isFinite(value);
const vectorValues = (vector: ArrayLike<number>): number[] => {
  if (!vector || !Number.isSafeInteger(vector.length) || vector.length < 1 || vector.length > MAX_HYBRID_VECTOR_DIMENSIONS) throw new Error('Invalid or oversized embedding vector');
  const values = Array.from(vector);
  if (values.some((value) => !finite(value))) throw new Error('Embedding vectors must contain finite numbers');
  if (!values.some((value) => value !== 0)) throw new Error('Embedding vectors must not be zero vectors');
  return values;
};

export const semanticCosine = (left: ArrayLike<number>, right: ArrayLike<number>): number => {
  const a = vectorValues(left); const b = vectorValues(right);
  if (a.length !== b.length) throw new Error(`Vector dimensions differ: ${a.length} vs ${b.length}`);
  let leftScale = 0; let rightScale = 0;
  for (let index = 0; index < a.length; index += 1) { leftScale = Math.max(leftScale, Math.abs(a[index])); rightScale = Math.max(rightScale, Math.abs(b[index])); }
  let dot = 0; let leftNorm = 0; let rightNorm = 0;
  for (let index = 0; index < a.length; index += 1) { const leftUnit = a[index] / leftScale; const rightUnit = b[index] / rightScale; dot += leftUnit * rightUnit; leftNorm += leftUnit ** 2; rightNorm += rightUnit ** 2; }
  return dot / Math.sqrt(leftNorm * rightNorm);
};

export const validateHybridWeights = (input: Partial<HybridWeights> = {}): HybridWeights => {
  const weights = { semantic: input.semantic ?? 0.7, serp: input.serp ?? 0.3 };
  if (!finite(weights.semantic) || !finite(weights.serp) || !finite(weights.semantic + weights.serp) || weights.semantic < 0 || weights.serp < 0 || weights.semantic + weights.serp <= 0) throw new Error('Hybrid weights must be finite, non-negative and non-zero');
  return weights;
};

const urls = (snapshot: SerpSnapshot): string[] => {
  if (!Array.isArray(snapshot.rows) || !Array.isArray(snapshot.urls) || snapshot.rows.length > TOP10_MAX_RESULTS || snapshot.urls.length > TOP10_MAX_RESULTS) throw new Error('SERP snapshots must contain at most TOP10 results');
  const values = [...new Set(snapshot.urls)];
  if (values.some((url) => typeof url !== 'string' || !url || url.length > MAX_SERP_URL_LENGTH)) throw new Error('SERP snapshot URLs must be bounded strings');
  return values;
};

const keywordKey = (value: unknown): string => {
  if (typeof value !== 'string') throw new Error('Hybrid keywords must be strings');
  const key = value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
  if (!key || key.length > MAX_SERP_KEYWORD_LENGTH) throw new Error('Hybrid keywords must be non-empty and bounded');
  return key;
};
const assertSnapshotKeyword = (keyword: string, snapshot?: SerpSnapshot | null): void => {
  if (snapshot && keywordKey(keyword) !== keywordKey(snapshot.keyword)) throw new Error('SERP snapshot keyword does not match hybrid keyword');
};

const serpEvidence = (left?: SerpSnapshot | null, right?: SerpSnapshot | null): { score: number | null; sharedURLs: string[]; reasons: string[] } => {
  if (!left || !right) return { score: null, sharedURLs: [], reasons: ['serp-snapshot-missing'] };
  urls(left); urls(right);
  if (!isFullScoreEligible(left.source) || !isFullScoreEligible(right.source)) {
    const reasons = [left.source.availability, right.source.availability].map((status, index) => `serp-${index ? 'b' : 'a'}-${status}`);
    return { score: null, sharedURLs: [], reasons };
  }
  if (!sameSerpContext(left.source, right.source)) return { score: null, sharedURLs: [], reasons: ['serp-context-incompatible'] };
  const leftURLs = urls(left); const rightURLs = urls(right);
  const sharedURLs = rightURLs.filter((url) => leftURLs.includes(url));
  const union = new Set([...leftURLs, ...rightURLs]);
  if (!union.size) return { score: null, sharedURLs, reasons: ['serp-no-results'] };
  return { score: sharedURLs.length / union.size, sharedURLs, reasons: ['serp-compatible'] };
};

export const serpJaccard = (left: SerpSnapshot, right: SerpSnapshot): number | null => serpEvidence(left, right).score;

export const scoreHybridPair = (left: HybridKeywordInput, right: HybridKeywordInput, inputWeights: Partial<HybridWeights> = {}): HybridEvidence => {
  const keywordA = keywordKey(left.keyword); const keywordB = keywordKey(right.keyword);
  assertSnapshotKeyword(left.keyword, left.snapshot); assertSnapshotKeyword(right.keyword, right.snapshot);
  const weights = validateHybridWeights(inputWeights); const semantic = semanticCosine(left.vector, right.vector);
  const serp = serpEvidence(left.snapshot, right.snapshot); const available = serp.score !== null;
  const appliedWeights = available ? { semantic: weights.semantic, serp: weights.serp } : { semantic: 1, serp: 0 };
  const denominator = appliedWeights.semantic + appliedWeights.serp;
  const score = available ? (semantic * appliedWeights.semantic + serp.score! * appliedWeights.serp) / denominator : semantic;
  return { keywordA, keywordB, semanticCosine: semantic, serpJaccard: serp.score, score, mode: available ? 'hybrid' : 'semantic-only', sharedUrls: serp.sharedURLs, sourceA: left.snapshot?.source ?? null, sourceB: right.snapshot?.source ?? null, weights, appliedWeights, reasons: serp.reasons };
};

export const clusterKeywordPairs = (vectors: ArrayLike<number>[], keywords: string[], snapshots: Array<SerpSnapshot | null | undefined>, threshold: number, inputWeights: Partial<HybridWeights> = {}): HybridEvidence[] => {
  if (vectors.length !== keywords.length || snapshots.length !== keywords.length) throw new Error('Vectors, keywords and snapshots must have equal lengths');
  if (vectors.length > MAX_HYBRID_KEYWORDS) throw new Error('Too many hybrid keywords');
  if (!finite(threshold) || threshold < -1 || threshold > 1) throw new Error('Hybrid threshold must be finite and within [-1, 1]');
  validateHybridWeights(inputWeights);
  const matches: HybridEvidence[] = [];
  for (let left = 0; left < keywords.length; left += 1) for (let right = left + 1; right < keywords.length; right += 1) {
    const evidence = scoreHybridPair({ keyword: keywords[left], vector: vectors[left], snapshot: snapshots[left] }, { keyword: keywords[right], vector: vectors[right], snapshot: snapshots[right] }, inputWeights);
    if (evidence.score >= threshold) matches.push(evidence);
  }
  return matches;
};
