import type { CrawledPageSummary } from '@/types';
import { nodesOf, type SchemaNode } from './graph';

/**
 * JSON-LD graph audit for the Trust report (#65). Dangling references, @id conflicts and entities
 * repeated without a shared @id come from the crawler's own graph analysis (#78), so there is no second
 * parser; this module only classifies those findings and adds per-page "islands": top-level nodes that
 * no @id reference connects.
 *
 * Decision (default chosen by agent): islands are reported, but the reference ×.65 penalty is NOT
 * applied to the score until the profile decision in #83, so stored history is never silently rescored.
 * Reference cycles are not flagged: JSON-LD allows two-way links (worksFor/employee, mainEntity/
 * mainEntityOfPage), so a cycle alone is not an error.
 */
export interface GraphAudit {
  pagesAudited: number;
  dangling: Array<{ page: string; property: string; id: string }>;
  conflicts: Array<{ id: string; kind: 'type-or-name' | 'same-as'; pages: string[] }>;
  unshared: Array<{ kind: string; name: string; pages: string[] }>;
  islands: Array<{ page: string; components: number; nodes: number }>;
}

const PREFIX = 'Structured data graph: ';
const DANGLING = /^(\S+) references undeclared local @id (.+) in this crawl\.$/;
const CONFLICT = /^local @id (.+) has (conflicting @type or name|inconsistent sameAs) declarations in this crawl\.$/;
const UNSHARED = /^(\w+) `(.+)` appears on multiple crawled pages without a shared @id\.$/;
const TOP_LEVEL = /^\$(?:\[\d+\])?(?:\.@graph\[\d+\])?$/;

const addPage = (pages: string[], page: string): void => { if (!pages.includes(page)) pages.push(page); };

const isInside = (child: SchemaNode, parent: SchemaNode): boolean => child.decl === parent.decl
  && child.path !== parent.path && child.path.startsWith(parent.path) && /^[.[]/.test(child.path.slice(parent.path.length));

/** Connected groups of top-level nodes on one page, linked by any @id that a node or its descendants mention. */
export const pageIslands = (nodes: SchemaNode[]): { components: number; nodes: number } => {
  const tops = nodes.filter((node) => TOP_LEVEL.test(node.path) && (node.types.length > 0 || node.id));
  const parent = tops.map((_, index) => index);
  const find = (index: number): number => (parent[index] === index ? index : (parent[index] = find(parent[index])));
  const owner = new Map<string, number>();
  tops.forEach((node, index) => { if (node.id) owner.set(node.id, index); });
  tops.forEach((top, index) => {
    const family = [top, ...nodes.filter((node) => isInside(node, top))];
    const mentioned = family.flatMap((node) => [...(node === top ? [] : node.id ? [node.id] : []), ...Object.values(node.props).flat()]);
    for (const id of mentioned) {
      const other = owner.get(id);
      if (other !== undefined) parent[find(other)] = find(index);
    }
  });
  return { components: new Set(tops.map((_, index) => find(index))).size, nodes: tops.length };
};

export const auditGraph = (pages: CrawledPageSummary[]): GraphAudit => {
  const audit: GraphAudit = { pagesAudited: 0, dangling: [], conflicts: [], unshared: [], islands: [] };
  for (const page of pages) {
    const url = page.final_url || page.url;
    const nodes = nodesOf(page);
    if (nodes.length) audit.pagesAudited += 1;
    for (const issue of page.issues ?? []) {
      if (!issue.message.startsWith(PREFIX)) continue;
      const message = issue.message.slice(PREFIX.length);
      const dangling = DANGLING.exec(message);
      const conflict = CONFLICT.exec(message);
      const unshared = UNSHARED.exec(message);
      if (dangling) audit.dangling.push({ page: url, property: dangling[1], id: dangling[2] });
      else if (conflict) {
        const kind = conflict[2] === 'inconsistent sameAs' ? 'same-as' : 'type-or-name';
        const found = audit.conflicts.find((item) => item.id === conflict[1] && item.kind === kind)
          ?? audit.conflicts[audit.conflicts.push({ id: conflict[1], kind, pages: [] }) - 1];
        addPage(found.pages, url);
      } else if (unshared) {
        const found = audit.unshared.find((item) => item.kind === unshared[1] && item.name === unshared[2])
          ?? audit.unshared[audit.unshared.push({ kind: unshared[1], name: unshared[2], pages: [] }) - 1];
        addPage(found.pages, url);
      }
    }
    const islands = pageIslands(nodes);
    if (islands.components > 1) audit.islands.push({ page: url, ...islands });
  }
  return audit;
};
