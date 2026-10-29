import { buildRegistry, isOrganizationNode, nodeIdentity, type SchemaNode } from './graph';
import type { AuthorEntity, SchemaGraphDetail } from './types';

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
  const organizations = nodes.filter(isOrganizationNode).map((node) => (node.id && registry.get(nodeIdentity(node))) || node);
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

/** 0-100: publisher entity (40%), author entities with ids and sameAs (35%), article attribution and dates (25%). */
export const schemaScore = (detail: SchemaGraphDetail, ymyl: boolean): number => {
  const { organization: org } = detail;
  const publisher = (org.present ? 0.15 : 0) + (org.hasId ? 0.1 : 0) + (org.sameAs.length ? 0.15 : 0);
  const persons = 0.15 * share(detail.personsWithId, detail.personCount) + 0.2 * share(detail.personsWithSameAs, detail.personCount);
  const parts = [share(detail.articlesWithAuthor, detail.articleCount), share(detail.articlesWithDate, detail.articleCount)];
  if (ymyl) parts.push(share(detail.articlesWithReviewer, detail.articleCount));
  const articles = (0.25 * parts.reduce((sum, value) => sum + value, 0)) / parts.length;
  return Math.round((publisher + persons + articles) * 100);
};
