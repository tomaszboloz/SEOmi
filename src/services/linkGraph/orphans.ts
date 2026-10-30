/**
 * One orphan rule for every module (#106 item 2). A page is an orphan when it is not a root
 * (crawl seed or home page) and no other page in the supplied edge set links to it. Self-links never
 * count. Modules differ only in which edges they pass (content-only links for the semantic map, TAS
 * silo and topical audit; all internal links for the crawl report). That choice belongs to the label
 * shown next to the number, never to a second definition of "orphan".
 */
export interface LinkGraphEdge { from: string; to: string }

export type InboundSources = ReadonlyMap<string, ReadonlySet<string>>;

/** Distinct linking pages per target; self-links are dropped. */
export const inboundSources = (edges: Iterable<LinkGraphEdge>): Map<string, Set<string>> => {
  const inbound = new Map<string, Set<string>>();
  for (const { from, to } of edges) {
    if (!from || !to || from === to) continue;
    const sources = inbound.get(to) ?? new Set<string>();
    sources.add(from);
    inbound.set(to, sources);
  }
  return inbound;
};

export const isOrphan = (node: string, inbound: InboundSources, roots: ReadonlySet<string>): boolean =>
  !roots.has(node) && !(inbound.get(node)?.size);

/** Orphan nodes among `nodes`, sorted, under the single rule above. */
export const orphanNodes = (nodes: readonly string[], edges: Iterable<LinkGraphEdge>, roots: ReadonlySet<string> = new Set()): string[] => {
  const inbound = inboundSources(edges);
  return nodes.filter((node) => isOrphan(node, inbound, roots)).sort();
};
