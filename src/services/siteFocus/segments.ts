import { bandFor, computeSfs } from './aggregate';
import type { AnchorResolution } from './anchors';
import type { TermCluster } from './cluster';
import { chooseCore, labelOf } from './coreTopic';
import { evaluatePage, modelFor, type EvalContext, type Prepared } from './evaluate';
import { pathSegments } from './pageType';
import type { FocusSegmentInput, SegmentFocus } from './types/segments';

export const MAX_SEGMENTS = 10;
export const MAX_SEGMENT_LABEL = 60;
export const MAX_SEGMENT_PREFIX = 200;
export const MAX_SEGMENT_TOPIC = 200;

const prefixParts = (prefix: string): string[] => pathSegments(`https://segment.invalid${prefix}`);

/** A path prefix below the root, without query, fragment or spaces; `/blog/` and `/Blog` both become `/blog`. */
const cleanPrefix = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw.startsWith('/') || raw.length > MAX_SEGMENT_PREFIX || /[\s?#]/.test(raw)) return null;
  const parts = prefixParts(raw);
  return parts.length ? `/${parts.join('/')}` : null;
};

/**
 * User-defined segments of a multi-topic site (#82 GEM-82-05): label, path prefix and an optional topic.
 * Invalid rows are dropped, not repaired; the first row wins for a repeated prefix.
 */
export const cleanSegments = (value: unknown): FocusSegmentInput[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: FocusSegmentInput[] = [];
  for (const row of value) {
    const record = (row ?? {}) as Record<string, unknown>;
    const label = typeof record.label === 'string' ? record.label.trim() : '';
    const pathPrefix = cleanPrefix(record.pathPrefix);
    const topic = typeof record.topic === 'string' ? record.topic.trim() : '';
    if (!label || label.length > MAX_SEGMENT_LABEL || !pathPrefix || topic.length > MAX_SEGMENT_TOPIC || seen.has(pathPrefix)) continue;
    seen.add(pathPrefix);
    out.push({ label, pathPrefix, ...(topic ? { topic } : {}) });
    if (out.length === MAX_SEGMENTS) break;
  }
  return out;
};

/** One segment per line: `Label | /path-prefix | optional topic`. */
export const parseSegmentInput = (text: string): FocusSegmentInput[] => cleanSegments(text.split('\n').map((line) => {
  const [label, pathPrefix, ...topic] = line.split('|');
  return { label, pathPrefix: pathPrefix?.trim(), topic: topic.join('|') };
}));

export const formatSegmentInput = (segments: readonly FocusSegmentInput[] = []): string =>
  segments.map((segment) => [segment.label, segment.pathPrefix, segment.topic].filter(Boolean).join(' | ')).join('\n');

const inSegment = (item: Prepared, parts: string[]): boolean => {
  const own = pathSegments(item.page.final_url || item.page.url);
  return parts.every((part, index) => own[index] === part);
};

/** Term mass of the segment's own pages, each L1-normalised: the segment's pages anchor its Core. */
const segmentAnchors = (indexes: number[], vectors: Map<string, number>[]): AnchorResolution => {
  const mass = new Map<string, number>();
  indexes.forEach((index) => {
    const total = [...vectors[index].values()].reduce((sum, value) => sum + value, 0);
    if (total > 0) vectors[index].forEach((value, key) => mass.set(key, (mass.get(key) ?? 0) + value / total));
  });
  return { sources: [], missing: [], applied: false, mass };
};

export interface SegmentInputs {
  items: Prepared[];
  live: Prepared[];
  vectors: Map<string, number>[];
  clusters: TermCluster[];
  totals: Map<string, number>;
  language: string;
  context: EvalContext;
}

/**
 * Scores each user segment against its own Core Topic: the segment's topic when given, otherwise the
 * cluster its pages carry most. The site-wide Core and SFS are not changed. An empty segment reads as
 * unavailable, never as 0.
 */
export const scoreSegments = (segments: FocusSegmentInput[], input: SegmentInputs): SegmentFocus[] => segments.map((segment) => {
  const parts = prefixParts(segment.pathPrefix);
  const own = input.items.filter((item) => inSegment(item, parts));
  const liveIndexes = input.live.map((item, index) => (inSegment(item, parts) ? index : -1)).filter((index) => index >= 0);
  const base = { label: segment.label, pathPrefix: segment.pathPrefix, ...(segment.topic ? { topic: segment.topic } : {}), source: 'user' as const, pageCount: own.length };
  if (!liveIndexes.length) return { ...base, scoredCount: 0, score: null, band: 'unavailable', coreLabel: '', coreMode: 'auto' };
  const selection = chooseCore(input.clusters, input.totals, segment.topic, input.language, segmentAnchors(liveIndexes, input.vectors));
  const termCluster = new Map(selection.clusters.flatMap((cluster) => cluster.keys.map((key): [string, string] => [key, cluster.id])));
  const model = modelFor(selection.core, selection.kCore, termCluster, input.totals);
  const labels = new Map(selection.clusters.map((cluster) => [cluster.id, labelOf(cluster.keys, input.context.surfaces)]));
  const scored = own.map((item) => evaluatePage(item, { ...input.context, model, labels }));
  const { score } = computeSfs(scored);
  return {
    ...base, scoredCount: liveIndexes.length, score, band: bandFor(score),
    coreLabel: segment.topic || labelOf(selection.core.keys, input.context.surfaces), coreMode: selection.mode,
  };
});
