import { buildRegistry, isOrganizationNode, type SchemaNode } from './graph';
import type { AuthorEntity, SchemaGraphDetail, ScoringProfile, YmylCategory } from './types';
import { reviewerApplicable } from './ymyl';

const DATE_PROPERTIES = ['dateModified', 'lastReviewed', 'datePublished'];

const share = (part: number, whole: number): number => (whole ? part / whole : 0);

/** Entity-reconciliation facts of the site's JSON-LD graph: publisher, bylines, dates, reviewers, citations. */
export const analyzeSchema = (
  nodes: SchemaNode[],
  articleNodes: Map<string, SchemaNode[]>,
  authors: AuthorEntity[],
  withAuthor: Set<string>,
  withReviewer: Set<string>,
): SchemaGraphDetail => {
  const registry = buildRegistry(nodes);
  const organizations = nodes.filter(isOrganizationNode).map((node) => (node.id && registry.get(node.id)) || node);
  const sameAs = [...new Set(organizations.flatMap((node) => node.props.sameAs ?? []))];
  const named = authors.filter((author) => !author.generic);
  const pagesWith = (test: (node: SchemaNode) => boolean): number => [...articleNodes.values()].filter((list) => list.some(test)).length;
  return {
    organization: { present: organizations.length > 0, hasId: organizations.some((node) => Boolean(node.id)), sameAs, name: organizations.find((node) => node.name)?.name },
    articleCount: articleNodes.size,
    articlesWithAuthor: withAuthor.size,
    articlesWithDate: pagesWith((node) => DATE_PROPERTIES.some((property) => node.props[property]?.length)),
    articlesWithReviewer: withReviewer.size,
    articlesWithCitation: pagesWith((node) => Boolean(node.props.citation?.length)),
    personCount: named.length,
    personsWithId: named.filter((author) => author.id).length,
    personsWithSameAs: named.filter((author) => author.sameAs.length).length,
  };
};

/** Legacy 0-100: publisher entity (40%), author entities ids sameAs (35%), article attribution dates (25%). */
const legacySchemaScore = (detail: SchemaGraphDetail, ymyl: boolean): number => {
  const { organization: org } = detail;
  const publisher = (org.present ? 0.15 : 0) + (org.hasId ? 0.1 : 0) + (org.sameAs.length ? 0.15 : 0);
  const persons = 0.15 * share(detail.personsWithId, detail.personCount) + 0.2 * share(detail.personsWithSameAs, detail.personCount);
  const parts = [share(detail.articlesWithAuthor, detail.articleCount), share(detail.articlesWithDate, detail.articleCount)];
  if (ymyl) parts.push(share(detail.articlesWithReviewer, detail.articleCount));
  const articles = (0.25 * parts.reduce((sum, value) => sum + value, 0)) / parts.length;
  return Math.round((publisher + persons + articles) * 100);
};

/** S_schema = .30 C_doc + .35 C_author + .20 C_reviewer + .15 C_publisher, each 0-1. */
export const SCHEMA_WEIGHTS = { doc: 0.3, author: 0.35, reviewer: 0.2, publisher: 0.15 } as const;

export const schemaComponents = (detail: SchemaGraphDetail): Record<keyof typeof SCHEMA_WEIGHTS, number> => {
  const { organization: org } = detail;
  return {
    doc: share(detail.articlesWithDate, detail.articleCount),
    author: 0.5 * share(detail.articlesWithAuthor, detail.articleCount) + 0.25 * share(detail.personsWithId, detail.personCount) + 0.25 * share(detail.personsWithSameAs, detail.personCount),
    reviewer: share(detail.articlesWithReviewer, detail.articleCount),
    publisher: (org.present ? 0.375 : 0) + (org.hasId ? 0.25 : 0) + (org.sameAs.length ? 0.375 : 0),
  };
};

/**
 * 0-100. Legacy profile keeps the pre-#65 formula. claim-backed-v1 uses the reference weights; the reviewer
 * component applies only where the YMYL category calls for it (never a universal medical reviewer), and the
 * remaining weights are renormalized when it does not.
 */
export const schemaScore = (detail: SchemaGraphDetail, ymyl: YmylCategory | boolean | undefined, profile: ScoringProfile = 'legacy'): number => {
  if (profile === 'legacy') return legacySchemaScore(detail, Boolean(ymyl));
  const parts = schemaComponents(detail);
  const useReviewer = typeof ymyl === 'string' && reviewerApplicable(ymyl);
  const keys = (Object.keys(SCHEMA_WEIGHTS) as Array<keyof typeof SCHEMA_WEIGHTS>).filter((key) => key !== 'reviewer' || useReviewer);
  const total = keys.reduce((sum, key) => sum + SCHEMA_WEIGHTS[key], 0);
  return Math.round((keys.reduce((sum, key) => sum + parts[key] * SCHEMA_WEIGHTS[key], 0) / total) * 100);
};
