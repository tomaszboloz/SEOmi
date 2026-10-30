import { isOrganizationNode, type SchemaNode } from './graph';

const PAGE_TYPE = /WebPage$/;

/**
 * @id values the crawl already declares for the publisher and for the page being fixed (#66 GEM-66-04),
 * so the generated graph extends those entities instead of creating parallel ones. Prefers nodes found on
 * the page itself; returns nothing for an entity the crawl never identified.
 */
export const observedEntityIds = (nodes: SchemaNode[], pageUrl: string): { organization?: string; page?: string } => {
  const onPage = (node: SchemaNode): number => (node.page === pageUrl ? 0 : 1);
  const organization = nodes.filter((node) => node.id && isOrganizationNode(node)).sort((a, b) => onPage(a) - onPage(b))[0]?.id;
  const page = nodes.find((node) => node.id && node.page === pageUrl && node.types.some((type) => PAGE_TYPE.test(type)))?.id;
  return { ...(organization ? { organization } : {}), ...(page ? { page } : {}) };
};
