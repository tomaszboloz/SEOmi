import { phraseKey } from '@/services/siteFocus/terms';
import { binary, cosine, type AuthorityContext, type AuthorityPage } from './context';
import { pageDepth } from './depth';
import type { CoverageStatus, GapLevel, PillarCoverage, RefSubtopic, ReferenceTaxonomy, SubtopicCoverage } from './types';

export const FULL_COSINE = 0.78;
export const PARTIAL_COSINE = 0.6;
export const SHALLOW_BELOW = 50;
const ENTITY_WEIGHT = 0.5;

const round1 = (value: number): number => Math.round(value * 10) / 10;

const gapLevel = (importance: number): GapLevel => (importance >= 0.8 ? 'critical' : importance >= 0.5 ? 'high' : 'medium');

/** Reference vector of a sub-topic: heading words plus the entities the market uses around it. */
const referenceVector = (subtopic: RefSubtopic, context: AuthorityContext): Map<string, number> => {
  const vector = binary(subtopic.keys);
  subtopic.entities.forEach((surface) => {
    const key = phraseKey(surface, context.language);
    if (key && !vector.has(key)) vector.set(key, ENTITY_WEIGHT);
  });
  return vector;
};

/** Page-to-sub-topic similarity: full page vector against the declared-topic zone, whichever fits better. */
const similarity = (entry: AuthorityPage, reference: Map<string, number>): number =>
  Math.max(cosine(reference, entry.vector), cosine(reference, binary(entry.zone)));

const covered = (value: number): 0 | 0.5 | 1 => (value >= FULL_COSINE ? 1 : value >= PARTIAL_COSINE ? 0.5 : 0);

/** Maps each reference sub-topic to the on-topic pages that cover it, then grades depth. */
export const mapCoverage = (pages: AuthorityPage[], context: AuthorityContext, taxonomy: ReferenceTaxonomy): SubtopicCoverage[] =>
  taxonomy.subtopics.map((subtopic) => {
    const reference = referenceVector(subtopic, context);
    const ranked = pages.map((entry) => ({ entry, value: similarity(entry, reference) })).filter((row) => covered(row.value) > 0)
      .sort((a, b) => b.value - a.value || (a.entry.url < b.entry.url ? -1 : 1));
    const best = ranked[0];
    const base = { subtopicId: subtopic.id, pillar: subtopic.pillar, label: subtopic.label, importance: subtopic.importance };
    if (!best) return { ...base, status: 'missing_gap' as CoverageStatus, coverage: 0 as const, urls: [], similarity: 0, entitiesPresent: [], entitiesMissing: subtopic.entities, questionsMissing: subtopic.questions, gap: gapLevel(subtopic.importance) };
    const depth = pageDepth(best.entry, subtopic, context, taxonomy);
    const coverage = covered(best.value);
    const shallow = coverage === 0.5 || (depth.depth !== null && depth.depth < SHALLOW_BELOW);
    return {
      ...base, status: (shallow ? 'covered_shallow' : 'covered_strong') as CoverageStatus, coverage,
      urls: ranked.filter((row) => covered(row.value) === 1).map((row) => row.entry.url).concat(coverage === 1 ? [] : [best.entry.url]),
      bestUrl: best.entry.url, similarity: round1(best.value * 100), ...(depth.depth === null ? {} : { depth: depth.depth }),
      entitiesPresent: depth.present, entitiesMissing: depth.missing, questionsMissing: depth.questionsMissing,
    };
  });

/** TCR = sum(I_j * Cov(s_j)) / sum(I_j) * 100. */
export const topicCoverageRatio = (rows: SubtopicCoverage[]): number | null => {
  const total = rows.reduce((sum, row) => sum + row.importance, 0);
  return total > 0 ? round1((rows.reduce((sum, row) => sum + row.importance * row.coverage, 0) / total) * 100) : null;
};

/** CDES: mean Entity Depth of the sub-topics the site covers. */
export const contentDepth = (rows: SubtopicCoverage[]): number | null => {
  const depths = rows.filter((row) => row.coverage > 0 && typeof row.depth === 'number').map((row) => row.depth as number);
  return depths.length ? round1(depths.reduce((sum, value) => sum + value, 0) / depths.length) : null;
};

export const pillarCoverage = (rows: SubtopicCoverage[], taxonomy: ReferenceTaxonomy): PillarCoverage[] =>
  taxonomy.pillars.map((pillar) => {
    const own = rows.filter((row) => row.pillar === pillar.id);
    return {
      id: pillar.id, label: pillar.label, subtopics: own.length, coveragePct: topicCoverageRatio(own) ?? 0,
      gaps: own.filter((row) => row.coverage === 0).length, shallow: own.filter((row) => row.status === 'covered_shallow').length,
    };
  });
