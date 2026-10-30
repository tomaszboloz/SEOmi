import { K_CORE_SIZE } from './coreTopic';
import { computeSfs } from './aggregate';
import { evaluatePage, modelFor, type EvalContext, type Prepared } from './evaluate';
import { pathSegments } from './pageType';
import { idf } from './terms';
import type { FocusCluster, PageFocus, SiteFlags, SubSite } from './types';
import type { TermCluster } from './cluster';

export const LOW_CONFIDENCE_PAGES = 10;
const LOW_CONFIDENCE_PCT = 20;
const MAX_SHARE_FOR_MULTI_TOPIC = 50;
const MIN_SIGNIFICANT_SHARE = 15;
const CLOSE_TO_TOP = 0.5;
const MIN_SEGMENT_PURITY = 0.6;
const MAX_SUB_SITES = 4;

export const dominantCluster = (item: Prepared, context: EvalContext): string | undefined => {
  const mass = new Map<string, number>();
  item.terms.entries.forEach((entry, key) => {
    const cluster = context.model.termCluster.get(key);
    if (cluster) mass.set(cluster, (mass.get(cluster) ?? 0) + (1 + Math.log(Math.max(1, entry.tf))) * idf(context.stats, key));
  });
  return [...mass].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]?.[0];
};

interface Aligned { cluster: FocusCluster; prefix: string }

/** A cluster is a sub-site when most of the pages it dominates share one first URL segment. */
const alignWithUrls = (significant: FocusCluster[], items: Prepared[], context: EvalContext): Aligned[] | null => {
  const found: Aligned[] = [];
  for (const cluster of significant) {
    const segments = items.filter((item) => !item.skipped && dominantCluster(item, context) === cluster.id)
      .map((item) => pathSegments(item.page.final_url || item.page.url)[0]).filter((segment): segment is string => !!segment);
    const counts = new Map<string, number>();
    segments.forEach((segment) => counts.set(segment, (counts.get(segment) ?? 0) + 1));
    const [modal, count] = [...counts].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0] ?? ['', 0];
    if (!modal || count / segments.length < MIN_SEGMENT_PURITY || found.some((entry) => entry.prefix === `/${modal}`)) return null;
    found.push({ cluster, prefix: `/${modal}` });
  }
  return found;
};

export const detectSubSites = (
  clusters: FocusCluster[], raw: TermCluster[], items: Prepared[], context: EvalContext, totals: Map<string, number>,
): SubSite[] => {
  const real = clusters.filter((cluster) => cluster.id !== 'manual');
  const top = real[0];
  if (!top || top.sharePct > MAX_SHARE_FOR_MULTI_TOPIC) return [];
  const significant = real.filter((cluster) => cluster.sharePct >= MIN_SIGNIFICANT_SHARE && cluster.weight >= top.weight * CLOSE_TO_TOP);
  if (significant.length < 2 || significant.length > MAX_SUB_SITES) return [];
  const aligned = alignWithUrls(significant, items, context);
  if (!aligned) return [];
  const live = items.filter((item) => !item.skipped);
  return aligned.map(({ cluster, prefix }) => {
    const source = raw.find((entry) => entry.id === cluster.id) as TermCluster;
    const model = modelFor(source, source.keys.slice(0, K_CORE_SIZE), context.model.termCluster, totals);
    const own = live.filter((item) => pathSegments(item.page.final_url || item.page.url)[0] === prefix.slice(1));
    const scored = own.map((item): PageFocus => evaluatePage(item, { ...context, model }));
    return {
      label: cluster.label, pathPrefix: prefix,
      sharePct: Math.round((own.length / Math.max(1, live.length)) * 1000) / 10,
      score: computeSfs(scored).score,
    };
  });
};

export const computeFlags = (
  items: Prepared[], confidence: number, manual: boolean, mode: SiteFlags['fallbackMode'], multiTopic: boolean,
  similaritySource?: SiteFlags['similaritySource'],
): SiteFlags => {
  const live = items.filter((item) => !item.skipped);
  return {
    isLowConfidence: live.length < LOW_CONFIDENCE_PAGES || (!manual && confidence < LOW_CONFIDENCE_PCT),
    isMultiTopic: multiTopic,
    fallbackMode: mode,
    ...(similaritySource ? { similaritySource } : {}),
    degraded: items.some((item) => !item.skipped && item.terms.degraded),
    skippedRenderTimeouts: items.filter((item) => item.skipped === 'render-timeout').length,
  };
};
