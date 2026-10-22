import type { Effort } from '@/services/siteFocus';
import { contentDepth, topicCoverageRatio } from './coverage';
import { blend } from './depth';
import { SILC_WEIGHTS } from './silo';
import { simulateTas, velocityScore } from './score';
import type { AuthorityRecommendation, CannibalGroup, FreshnessReport, Pillars, SiloReport, SubtopicCoverage } from './types';

const MAX_ITEMS = 8;
const MAX_PILLAR_RECS = 3;
const DEEPENED_DEPTH = 80;

const round1 = (value: number): number => Math.round(value * 10) / 10;
const effort = (min: number, max: number): Effort => ({ minHours: round1(min), maxHours: round1(max), estimate: true });

export interface RecommendInput {
  coverage: SubtopicCoverage[];
  pillars: Pillars;
  sfs: number;
  silo: SiloReport;
  cannibalization: CannibalGroup[];
  cannibalizationIndex: number;
  freshness: FreshnessReport;
  pillarLabels: Map<string, string>;
}

const gain = (input: RecommendInput, patch: Partial<Pillars>): number => {
  const before = simulateTas(input.pillars, input.sfs);
  const after = simulateTas({ ...input.pillars, ...patch }, input.sfs);
  return before === null || after === null ? 0 : Math.max(0, after - before);
};

const make = (code: AuthorityRecommendation['code'], params: AuthorityRecommendation['params'], delta: number, cost: Effort, items: string[], urls: string[]): AuthorityRecommendation => ({
  code, params, deltaTas: round1(delta), effort: cost, ratio: round1(delta / Math.max(0.25, (cost.minHours + cost.maxHours) / 2)), items: items.slice(0, MAX_ITEMS), urls: urls.slice(0, MAX_ITEMS),
});

const linkingPotential = (silo: SiloReport): number | null => blend([
  [SILC_WEIGHTS.connectivity, silo.clusterConnectivity], [SILC_WEIGHTS.anchors, silo.anchorAlignment], [SILC_WEIGHTS.orphans, 1],
]);

/** Topical Expansion Engine: each fix is simulated against TAS, then ranked by gain per average hour. */
export const buildAuthorityRecommendations = (input: RecommendInput): AuthorityRecommendation[] => {
  if (input.pillars.tcr === null) return [];
  const recs: AuthorityRecommendation[] = [];
  const gaps = input.coverage.filter((row) => row.coverage === 0).sort((a, b) => b.importance - a.importance || (a.label < b.label ? -1 : 1));
  const byPillar = new Map<string, SubtopicCoverage[]>();
  gaps.forEach((row) => byPillar.set(row.pillar, [...(byPillar.get(row.pillar) ?? []), row]));
  [...byPillar].map(([pillar, rows]) => {
    const fixed = input.coverage.map((row) => (rows.includes(row) ? { ...row, coverage: 1 as const } : row));
    return { pillar, rows, delta: gain(input, { tcr: topicCoverageRatio(fixed) }) };
  }).sort((a, b) => b.delta - a.delta || (a.pillar < b.pillar ? -1 : 1)).slice(0, MAX_PILLAR_RECS).forEach(({ pillar, rows, delta }) =>
    recs.push(make('fill-gaps', { pillar: input.pillarLabels.get(pillar) ?? pillar, count: rows.length }, delta, effort(3 * rows.length, 6 * rows.length), rows.map((row) => row.label), [])));
  if (input.cannibalization.length) {
    recs.push(make('merge-cannibalized', { count: input.cannibalization.length }, gain(input, { cvff: velocityScore(input.freshness.ratio, 0) }),
      effort(1.5 * input.cannibalization.length, 3 * input.cannibalization.length), input.cannibalization.map((group) => group.canonical), input.cannibalization.flatMap((group) => group.urls)));
  }
  const linkable = input.silo.orphans.length + input.silo.bleedLinks.length;
  const potential = linkingPotential(input.silo);
  if (linkable && potential !== null && input.pillars.silc !== null) {
    recs.push(make('fix-linking', { orphans: input.silo.orphans.length, bleed: input.silo.bleedLinks.length }, gain(input, { silc: Math.max(input.pillars.silc, round1(potential * 100)) }),
      effort(0.25 * linkable, 0.5 * linkable), input.silo.orphans, input.silo.bleedLinks.map((link) => link.from)));
  }
  const shallow = input.coverage.filter((row) => row.status === 'covered_shallow' && typeof row.depth === 'number');
  if (shallow.length) {
    const deeper = input.coverage.map((row) => (shallow.includes(row) ? { ...row, depth: Math.max(row.depth as number, DEEPENED_DEPTH) } : row));
    recs.push(make('deepen-shallow', { count: shallow.length }, gain(input, { cdes: contentDepth(deeper) }), effort(shallow.length, 2 * shallow.length), shallow.map((row) => row.label), shallow.flatMap((row) => (row.bestUrl ? [row.bestUrl] : []))));
  }
  if (input.freshness.stale.length && input.freshness.ratio !== null) {
    recs.push(make('refresh-stale', { count: input.freshness.stale.length }, gain(input, { cvff: velocityScore(1, input.cannibalizationIndex) }),
      effort(0.5 * input.freshness.stale.length, input.freshness.stale.length), [], input.freshness.stale));
  }
  return recs.sort((a, b) => b.ratio - a.ratio || b.deltaTas - a.deltaTas || (a.code < b.code ? -1 : 1));
};
