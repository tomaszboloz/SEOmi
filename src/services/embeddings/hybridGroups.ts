import { clusterKeywordPairs, type HybridWeights } from './hybridSerp';
import type { SerpSnapshot } from '../serpImport';
import type { Vector } from './types';
import { normalize } from './vector';
import type { Cluster } from './cluster';

/** Connected components of qualifying pairs; singletons remain explicit. */
export const hybridKeywordGroups = (
  keywords: string[], vectors: Vector[], snapshots: SerpSnapshot[], threshold: number, weights?: Partial<HybridWeights>,
) => {
  const keywordKey = (keyword: string) => keyword.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
  const keys = keywords.map(keywordKey);
  if (new Set(keys).size !== keys.length) throw new Error('Hybrid keywords must be distinct');
  const byKeyword = new Map(snapshots.map(snapshot => [keywordKey(snapshot.keyword), snapshot]));
  const aligned = keys.map(keyword => byKeyword.get(keyword) ?? null);
  const pairEvidence = clusterKeywordPairs(vectors, keywords, aligned, threshold, weights);
  const parents = keywords.map((_, index) => index);
  const root = (index: number): number => {
    while (parents[index] !== index) index = parents[index];
    return index;
  };
  const indices = new Map(keys.map((keyword, index) => [keyword, index]));
  for (const pair of pairEvidence) {
    const left = indices.get(pair.keywordA)!;
    const right = indices.get(pair.keywordB)!;
    parents[root(right)] = root(left);
  }
  const groups = new Map<number, number[]>();
  keywords.forEach((_, index) => {
    const parent = root(index);
    const members = groups.get(parent) ?? [];
    members.push(index);
    groups.set(parent, members);
  });
  const clusters: Cluster[] = [...groups.values()].map(members => {
    const sum = new Float64Array(vectors[members[0]].length);
    let scale = 0;
    for (const member of members) for (const value of vectors[member]) scale = Math.max(scale, Math.abs(value));
    for (const member of members) for (let dimension = 0; dimension < sum.length; dimension++) sum[dimension] += vectors[member][dimension] / scale;
    return { members, centroid: normalize(sum) };
  });
  return { clusters, pairEvidence };
};
