import type { ClusterTerm, CoreTopic, CoreTopicMode, FocusCluster } from './types';
import type { AnchorResolution } from './anchors';
import type { TermCluster } from './cluster';
import { phraseKey } from './terms';

export const K_CORE_SIZE = 40;
const LABEL_TERMS = 3;
const SHOWN_TERMS = 15;
const round1 = (value: number): number => Math.round(value * 10) / 10;

export interface CoreSelection {
  clusters: TermCluster[];
  core: TermCluster;
  confidence: number;
  weights: Map<string, number>;
  kCore: string[];
  manual?: { input: string; matched: boolean };
  mode: CoreTopicMode;
  anchors?: AnchorResolution;
}

export const labelOf = (keys: string[], surfaces: Map<string, string>): string =>
  keys.slice(0, LABEL_TERMS).map((key) => surfaces.get(key) ?? key).join(', ');

/** Keys a user-typed topic stands for: each phrase, plus its single words. */
export const manualKeys = (input: string | string[], language: string): string[] => {
  const phrases = (Array.isArray(input) ? input : input.split(/[,;\n]+/)).map((item) => item.trim()).filter(Boolean);
  const keys = new Set<string>();
  phrases.forEach((phrase) => {
    const key = phraseKey(phrase, language);
    if (!key) return;
    keys.add(key);
    key.split(' ').forEach((part) => keys.add(part));
  });
  return [...keys].sort();
};

const share = (core: TermCluster, clusters: TermCluster[]): number => {
  const total = clusters.reduce((sum, cluster) => sum + cluster.weight, 0);
  return total > 0 ? round1((core.weight / total) * 100) : 0;
};

/** Cluster carrying most of the anchor pages' term mass; undefined when anchors share no clustered term. */
const anchoredIndex = (base: TermCluster[], anchors: AnchorResolution | undefined): number | undefined => {
  if (!anchors) return undefined;
  const hits = base.map((cluster) => cluster.keys.reduce((sum, key) => sum + (anchors.mass.get(key) ?? 0), 0));
  const best = hits.indexOf(Math.max(...hits));
  return hits[best] > 0 ? best : undefined;
};

/**
 * Manual topic wins and re-centres on the cluster it overlaps most (or stands alone). Without it,
 * home + anchor pages pick the cluster, so a large blog cannot silently redefine the offer.
 * Otherwise the heaviest cluster is the Core Topic.
 */
export const chooseCore = (
  clusters: TermCluster[], totals: Map<string, number>, input: string | string[] | undefined, language: string,
  anchors?: AnchorResolution,
): CoreSelection => {
  const base = clusters.length ? clusters : [{ id: 'c1', keys: [], weight: 0 }];
  const keys = input === undefined ? [] : manualKeys(input, language);
  const finish = (all: TermCluster[], core: TermCluster, mode: CoreTopicMode, manual?: CoreSelection['manual']): CoreSelection =>
    complete(all, core, totals, { manual, mode, anchors: anchors && { ...anchors, applied: mode === 'anchored' } });
  if (input === undefined || !keys.length) {
    const anchored = anchoredIndex(base, anchors);
    return anchored === undefined ? finish(base, base[0], 'auto') : finish(base, base[anchored], 'anchored');
  }
  const label = (Array.isArray(input) ? input.join(', ') : input).trim();
  const hits = base.map((cluster) => keys.reduce((sum, key) => sum + (cluster.keys.includes(key) ? totals.get(key) as number : 0), 0));
  const best = hits.indexOf(Math.max(...hits));
  if (hits[best] > 0) {
    const core = base[best];
    const boosted = [...keys.filter((key) => core.keys.includes(key)), ...core.keys.filter((key) => !keys.includes(key))];
    return finish(base, { ...core, keys: boosted }, 'manual', { input: label, matched: true });
  }
  const synthetic: TermCluster = { id: 'manual', keys, weight: keys.reduce((sum, key) => sum + (totals.get(key) ?? 0), 0) };
  return finish([...base, synthetic], synthetic, 'manual', { input: label, matched: false });
};

const complete = (
  clusters: TermCluster[], core: TermCluster, totals: Map<string, number>, extra: Pick<CoreSelection, 'manual' | 'mode' | 'anchors'>,
): CoreSelection => ({
  clusters, core, ...extra,
  confidence: share(core, clusters),
  weights: new Map(core.keys.map((key) => [key, totals.get(key) ?? 0])),
  kCore: core.keys.slice(0, K_CORE_SIZE),
});

export const describeCore = (
  selection: CoreSelection, surfaces: Map<string, string>, documentFrequency: Map<string, number>, pageCount: number,
): CoreTopic => {
  const { core, manual, mode, anchors } = selection;
  const terms = core.keys.slice(0, SHOWN_TERMS).map((key) => ({
    term: surfaces.get(key) ?? key,
    coveragePct: round1(((documentFrequency.get(key) ?? 0) / Math.max(1, pageCount)) * 100),
    weight: round1(selection.weights.get(key) as number),
  }));
  return {
    label: manual?.input || labelOf(core.keys, surfaces), terms, clusterId: core.id, mode,
    ...(manual ? { manualOverride: manual } : {}),
    ...(anchors ? { anchors: { sources: anchors.sources, missing: anchors.missing, applied: anchors.applied } } : {}),
  };
};

export const describeClusters = (clusters: TermCluster[], surfaces: Map<string, string>, totals: Map<string, number>): FocusCluster[] => {
  const total = clusters.reduce((sum, cluster) => sum + cluster.weight, 0);
  return clusters.map((cluster) => ({
    id: cluster.id,
    label: labelOf(cluster.keys, surfaces),
    weight: round1(cluster.weight),
    sharePct: total > 0 ? round1((cluster.weight / total) * 100) : 0,
    terms: cluster.keys.slice(0, SHOWN_TERMS).map((key): ClusterTerm => ({ term: surfaces.get(key) ?? key, weight: round1(totals.get(key) ?? 0) })),
  }));
};
