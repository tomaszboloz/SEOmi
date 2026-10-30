import type { TermSimilarity } from './types';

export const MAX_CLUSTER_TERMS = 500;
export const DEFAULT_CLUSTER_CUT = 0.15;
const MIN_CLUSTER_SIZE = 2;
const ATTACH_FRACTION = 0.5;

export interface TermCluster { id: string; keys: string[]; weight: number }

/** Site weight of every term: the sum of its TF-IDF over all pages. */
export const siteTotals = (vectors: Map<string, number>[]): Map<string, number> => {
  const totals = new Map<string, number>();
  vectors.forEach((vector) => vector.forEach((value, key) => totals.set(key, (totals.get(key) ?? 0) + value)));
  return totals;
};

export const topTerms = (totals: Map<string, number>, limit = MAX_CLUSTER_TERMS): Array<{ key: string; weight: number }> =>
  [...totals].map(([key, weight]) => ({ key, weight }))
    .sort((a, b) => b.weight - a.weight || (a.key < b.key ? -1 : 1)).slice(0, limit);

/** Cosine of term page-incidence vectors; ordered by index, so the matrix is deterministic. */
const cooccurrence = (keys: string[], vectors: Map<string, number>[]): Float64Array => {
  const n = keys.length;
  const index = new Map(keys.map((key, i) => [key, i]));
  const dot = new Float64Array(n * n);
  vectors.forEach((vector) => {
    const present: Array<[number, number]> = [];
    vector.forEach((value, key) => {
      const i = index.get(key);
      if (i !== undefined) present.push([i, value]);
    });
    present.forEach(([i, a]) => present.forEach(([j, b]) => { dot[i * n + j] += a * b; }));
  });
  const result = new Float64Array(n * n);
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      const norm = Math.sqrt(dot[i * n + i] * dot[j * n + j]);
      result[i * n + j] = i === j || norm === 0 ? (i === j ? 1 : 0) : dot[i * n + j] / norm;
    }
  }
  return result;
};

/** Blends the hook into the co-occurrence matrix; returns how many term pairs got a finite value. */
const blend = (matrix: Float64Array, keys: string[], hook: TermSimilarity | undefined): number => {
  if (!hook) return 0;
  let used = 0;
  const n = keys.length;
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      const extra = hook(keys[i], keys[j]);
      if (typeof extra !== 'number' || !Number.isFinite(extra)) continue;
      const value = (matrix[i * n + j] + Math.max(0, Math.min(1, extra))) / 2;
      matrix[i * n + j] = value;
      matrix[j * n + i] = value;
      used += 1;
    }
  }
  return used;
};

/**
 * Deterministic average-linkage agglomerative clustering with a threshold cut.
 * Ties break on the lowest indices; terms arrive pre-sorted, so no randomness.
 */
export const clusterTerms = (
  terms: Array<{ key: string; weight: number }>,
  vectors: Map<string, number>[],
  options: { cut?: number; similarity?: TermSimilarity } = {},
): { clusters: TermCluster[]; unassigned: string[]; similarityPairs: number } => {
  const keys = terms.map((term) => term.key);
  const weightOf = new Map(terms.map((term) => [term.key, term.weight]));
  const weight = (key: string): number => weightOf.get(key) as number;
  const n = keys.length;
  const cut = options.cut ?? DEFAULT_CLUSTER_CUT;
  const sim = cooccurrence(keys, vectors);
  const similarityPairs = blend(sim, keys, options.similarity);
  const members: number[][] = keys.map((_, i) => [i]);
  const active = new Set(keys.map((_, i) => i));
  for (;;) {
    let best = -1;
    let bi = -1;
    let bj = -1;
    const list = [...active];
    list.forEach((i, x) => list.slice(x + 1).forEach((j) => {
      if (sim[i * n + j] > best) { best = sim[i * n + j]; bi = i; bj = j; }
    }));
    if (bi < 0 || best < cut) break;
    const sa = members[bi].length;
    const sb = members[bj].length;
    list.forEach((k) => {
      if (k === bi || k === bj) return;
      const value = (sa * sim[bi * n + k] + sb * sim[bj * n + k]) / (sa + sb);
      sim[bi * n + k] = value;
      sim[k * n + bi] = value;
    });
    members[bi] = [...members[bi], ...members[bj]];
    active.delete(bj);
  }
  // Leftover single terms join the cluster they are closest to, if close enough to matter.
  const anchors = [...active].filter((k) => members[k].length >= MIN_CLUSTER_SIZE);
  [...active].filter((k) => members[k].length < MIN_CLUSTER_SIZE).forEach((i) => {
    const target = anchors.reduce((best, k) => (best < 0 || sim[i * n + k] > sim[i * n + best] ? k : best), -1);
    if (target < 0 || sim[i * n + target] < cut * ATTACH_FRACTION) return;
    members[target] = [...members[target], ...members[i]];
    active.delete(i);
  });
  const groups = [...active].map((i) => members[i].map((m) => keys[m]));
  const kept = groups.filter((group) => group.length >= MIN_CLUSTER_SIZE).map((group) => {
    const sorted = [...group].sort((a, b) => weight(b) - weight(a) || (a < b ? -1 : 1));
    return { keys: sorted, weight: sorted.reduce((sum, key) => sum + weight(key), 0) };
  }).sort((a, b) => b.weight - a.weight || (a.keys[0] < b.keys[0] ? -1 : 1));
  return {
    clusters: kept.map((cluster, i) => ({ id: `c${i + 1}`, ...cluster })),
    unassigned: groups.filter((group) => group.length < MIN_CLUSTER_SIZE).flat().sort(),
    similarityPairs,
  };
};
