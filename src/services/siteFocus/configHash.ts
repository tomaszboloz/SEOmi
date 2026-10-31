import { stableHash } from './profile';
import type { SiteFocusOptions } from './types';

type ConfigInput = Pick<SiteFocusOptions, 'manualTopic' | 'anchorUrls' | 'businessGoal' | 'brand' | 'includeNonIndexable' | 'clusterCut'>;

const list = (value: readonly string[] | string | undefined, fold = true): string[] =>
  [...new Set((typeof value === 'string' ? [value] : value ?? []).map((item) => (fold ? item.trim().toLowerCase() : item.trim())).filter(Boolean))].sort();

/**
 * Hash of the project inputs that pick the Core Topic and filter terms (#82 GEM-82-06/07). Two
 * reports with different hashes were built from different choices: dependent TAS/IGOS/EETV views
 * must be rebuilt and the history keeps both versions instead of overwriting one with the other.
 * User segments are left out on purpose: they add per-segment scores but never change the site Core or SFS.
 */
export const focusConfigHash = (options: ConfigInput = {}): string => stableHash({
  manualTopic: list(options.manualTopic),
  anchors: list(options.anchorUrls, false),
  goal: (options.businessGoal ?? '').trim().toLowerCase(),
  brand: { aliases: list(options.brand?.aliases), competitors: list(options.brand?.competitors), exceptions: list(options.brand?.exceptions) },
  gated: options.includeNonIndexable === true,
  cut: options.clusterCut ?? null,
});
