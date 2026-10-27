import type { FocusPage, SiteFocusReport } from '@/services/siteFocus';
import { cannibalizationIndex, findCannibalization } from './cannibal';
import { buildContext, eligiblePages, type AuthorityContext, type AuthorityPage } from './context';
import { contentDepth, mapCoverage, pillarCoverage, topicCoverageRatio } from './coverage';
import { measureFreshness } from './freshness';
import { buildAuthorityRecommendations } from './recommend';
import { aggregateTas, quadrantFor, velocityScore } from './score';
import { auditSilo, contentEdges, groupByDirectory } from './silo';
import { splitTemplates } from './templates';
import { TAS_VERSION, type AuthorityWarning, type ReferenceTaxonomy, type SubtopicCoverage, type TopicalAuthorityReport } from './types';

export interface AuthorityOptions { taxonomy?: ReferenceTaxonomy | null; now?: string }

const EMPTY_AUTHORITY_TCR = 50;
const EMPTY_AUTHORITY_DEPTH = 30;

/** Pillar groups: each page joins the pillar of its most important sub-topic. */
const groupByPillar = (coverage: SubtopicCoverage[], context: AuthorityContext): Map<string, AuthorityPage[]> => {
  const assigned = new Map<string, string>();
  [...coverage].filter((row) => row.coverage > 0).sort((a, b) => b.importance - a.importance || (a.subtopicId < b.subtopicId ? -1 : 1))
    .forEach((row) => row.urls.forEach((url) => { if (!assigned.has(url)) assigned.set(url, row.pillar); }));
  const groups = new Map<string, AuthorityPage[]>();
  assigned.forEach((pillar, url) => { const entry = context.byUrl.get(url); if (entry) groups.set(pillar, [...(groups.get(pillar) ?? []), entry]); });
  return groups;
};

/** Topical Authority Score: coverage, depth, silo cohesion and velocity, coupled to the Site Focus Score. */
export const buildAuthorityReport = (pages: FocusPage[], startUrl: string, sfs: SiteFocusReport, options: AuthorityOptions = {}): TopicalAuthorityReport => {
  const now = options.now ?? new Date().toISOString();
  const taxonomy = options.taxonomy ?? null;
  const context = buildContext(pages, startUrl, sfs);
  const { representatives, duplicates } = splitTemplates(eligiblePages(context));
  const mapped = taxonomy ? mapCoverage(representatives, context, taxonomy) : [];
  const silo = auditSilo(context, representatives, taxonomy ? groupByPillar(mapped, context) : groupByDirectory(representatives));
  const edges = contentEdges(context);
  const inbound = new Map<string, number>();
  edges.forEach((edge) => inbound.set(edge.to, (inbound.get(edge.to) ?? 0) + 1));
  const cannibalization = findCannibalization(representatives, context, mapped, inbound);
  const index = cannibalizationIndex(cannibalization, representatives.length);
  const clashing = new Set(cannibalization.flatMap((group) => (group.subtopicId ? [group.subtopicId] : [])));
  const coverage = mapped.map((row): SubtopicCoverage => (clashing.has(row.subtopicId) ? { ...row, status: 'cannibalized' } : row));
  const freshness = measureFreshness(representatives, now);
  const pillars = {
    tcr: taxonomy ? topicCoverageRatio(coverage) : null,
    cdes: taxonomy ? contentDepth(coverage) : null,
    silc: silo.score,
    cvff: representatives.length ? velocityScore(freshness.ratio, index) : null,
  };
  const aggregate = aggregateTas(pillars, sfs.score);
  const warnings: AuthorityWarning[] = [];
  if (!taxonomy) warnings.push('no-pillars');
  if (pillars.tcr !== null && pillars.tcr >= EMPTY_AUTHORITY_TCR && pillars.cdes !== null && pillars.cdes < EMPTY_AUTHORITY_DEPTH) warnings.push('empty-authority');
  if (duplicates.length) warnings.push('template-duplicates');
  if (representatives.length && !freshness.dated) warnings.push('no-dates');
  if (!edges.length) warnings.push('no-links');
  const labels = new Map((taxonomy?.pillars ?? []).map((pillar) => [pillar.id, pillar.label]));
  return {
    tas: aggregate.tas, tasRaw: aggregate.tasRaw, multiplier: aggregate.multiplier, sfs: sfs.score,
    quadrant: aggregate.tas === null ? null : quadrantFor(sfs.score, aggregate.tas),
    pillars, unavailable: aggregate.unavailable, cannibalizationIndex: index, coverage,
    pillarCoverage: taxonomy ? pillarCoverage(coverage, taxonomy) : [], silo, cannibalization, freshness,
    recommendations: buildAuthorityRecommendations({ coverage, pillars, sfs: sfs.score, silo, cannibalization, cannibalizationIndex: index, freshness, pillarLabels: labels }),
    warnings, templateDuplicates: duplicates, taxonomy, pageCount: context.pages.length, generatedAt: now, version: TAS_VERSION,
  };
};
