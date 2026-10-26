import type { PageFeatures } from './types';

export const SSAS_PROFILE = { minBenchmarkPages: 3, mismatchBelow: 55, vectorCaps: [5, 5, 10, 5, 3, 10, 3000, 1] } as const;

const cap = (n: number, max: number) => Math.min(1, n / max);

/** F = [tables, ol, ul, form inputs, calculators, product cards, words, headings per 100 words], all scaled to 0-1. */
export const featureVector = (f: PageFeatures): number[] => {
  const caps = SSAS_PROFILE.vectorCaps;
  const ratio = f.words ? (f.headings / f.words) * 100 : 0;
  return [f.tables, f.orderedLists, f.unorderedLists, f.formInputs, f.calculators, f.productCards, f.words, ratio].map((v, i) => cap(v, caps[i]));
};

const norm = (v: number[]) => Math.sqrt(v.reduce((s, x) => s + x * x, 0));

export type SsasStatus = 'aligned' | 'mismatch' | 'inconclusive';
export interface SsasResult { status: SsasStatus; score: number | null; benchmarkPages: number }

/** Mean vector of the real TOP pages; no hardcoded sample vector. */
export const benchmark = (pages: PageFeatures[]): number[] | null => {
  if (pages.length < SSAS_PROFILE.minBenchmarkPages) return null;
  const vectors = pages.map(featureVector);
  return vectors[0].map((_, i) => vectors.reduce((s, v) => s + v[i], 0) / vectors.length);
};

/** SSAS = 100 * (1 - ||Fp - Fs|| / (||Fp|| + ||Fs||)). Zero denominator or missing benchmark is inconclusive. */
export const ssas = (page: PageFeatures, top: PageFeatures[]): SsasResult => {
  const bench = benchmark(top);
  const fp = featureVector(page);
  const denominator = bench ? norm(fp) + norm(bench) : 0;
  if (!bench || denominator === 0) return { status: 'inconclusive', score: null, benchmarkPages: top.length };
  const score = Math.round(100 * (1 - norm(fp.map((x, i) => x - bench[i])) / denominator) * 10) / 10;
  return { status: score < SSAS_PROFILE.mismatchBelow ? 'mismatch' : 'aligned', score, benchmarkPages: top.length };
};
