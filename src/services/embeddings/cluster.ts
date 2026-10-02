import type { Vector } from './types.ts';
import { cosine, normalize } from './vector.ts';

export interface Cluster {
  members: number[];
  centroid: Vector;
  label?: string;
}

/**
 * Single-pass centroid clustering: each text joins the most similar existing
 * cluster if the similarity reaches `threshold`, otherwise it starts a new one.
 * Deterministic for a given input order; suited to keyword grouping.
 */
export const clusterVectors = (vectors: Vector[], threshold: number): Cluster[] => {
  if (!(threshold > -1 && threshold <= 1)) throw new Error('threshold must be in (-1, 1]');
  const clusters: Array<Cluster & { sum: Float64Array }> = [];
  vectors.forEach((vector, index) => {
    let best = -1;
    let bestScore = -Infinity;
    clusters.forEach((cluster, clusterIndex) => {
      const score = cosine(vector, cluster.centroid);
      if (score > bestScore) [best, bestScore] = [clusterIndex, score];
    });
    if (best >= 0 && bestScore >= threshold) {
      const cluster = clusters[best];
      cluster.members.push(index);
      for (let dimension = 0; dimension < vector.length; dimension += 1) cluster.sum[dimension] += vector[dimension];
      cluster.centroid = normalize(cluster.sum);
    } else {
      clusters.push({ members: [index], centroid: vector, sum: Float64Array.from(vector) });
    }
  });
  return clusters.map(({ members, centroid }) => ({ members, centroid }));
};

/** Prompt asking an LLM for a short name of one keyword group. */
export const clusterLabelPrompt = (texts: string[]): string =>
  ['Name this group of search queries in at most five words, in the language of the queries.',
    'Reply with the name only.', '', ...texts.slice(0, 25).map((text) => `- ${text.slice(0, 200)}`)].join('\n');

/** Adds LLM labels to clusters; a failed label leaves that cluster unnamed. */
export const labelClusters = async (clusters: Cluster[], texts: string[], generate: (prompt: string) => Promise<string>): Promise<Cluster[]> => {
  const labelled: Cluster[] = [];
  for (const cluster of clusters) {
    try {
      const label = (await generate(clusterLabelPrompt(cluster.members.map((index) => texts[index])))).split('\n')[0].replace(/^["'\-\s]+|["'\s]+$/g, '').slice(0, 80);
      labelled.push(label ? { ...cluster, label } : cluster);
    } catch {
      labelled.push(cluster);
    }
  }
  return labelled;
};

/** Share of texts whose cluster's majority label equals their own label (0..1). */
export const clusterPurity = (clusters: Cluster[], labels: string[]): number => {
  if (!labels.length) return 0;
  const majority = clusters.reduce((sum, cluster) => {
    const counts = new Map<string, number>();
    for (const member of cluster.members) counts.set(labels[member], (counts.get(labels[member]) ?? 0) + 1);
    return sum + Math.max(0, ...counts.values());
  }, 0);
  return majority / labels.length;
};
