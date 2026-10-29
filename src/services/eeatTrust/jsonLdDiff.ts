type Node = Record<string, unknown>;

export interface JsonLdDiffEntry { id: string; property: string; value: unknown }
export interface JsonLdDiff { added: JsonLdDiffEntry[]; removed: JsonLdDiffEntry[] }

const nodesById = (graph: Record<string, unknown> | undefined): Map<string, Node> => {
  const list = graph?.['@graph'];
  const nodes = Array.isArray(list) ? list.filter((item): item is Node => Boolean(item) && typeof item === 'object') : [];
  return new Map(nodes.flatMap((node) => (typeof node['@id'] === 'string' ? [[node['@id'], node] as const] : [])));
};
const same = (left: unknown, right: unknown): boolean => JSON.stringify(left) === JSON.stringify(right);
const entries = (node: Node): Array<[string, unknown]> => Object.entries(node).filter(([key, value]) => key !== '@id' && value !== undefined);

/** Property-level diff of the proposed graph against the graph observed in the crawl. Nodes are matched by @id. */
export const diffAgainstObserved = (observed: Record<string, unknown> | undefined, proposed: Record<string, unknown>): JsonLdDiff => {
  const before = nodesById(observed);
  const after = nodesById(proposed);
  const added: JsonLdDiffEntry[] = [];
  const removed: JsonLdDiffEntry[] = [];
  after.forEach((node, id) => {
    const old = before.get(id);
    entries(node).forEach(([property, value]) => { if (!old || !same(old[property], value)) added.push({ id, property, value }); });
  });
  before.forEach((node, id) => {
    const next = after.get(id);
    entries(node).forEach(([property, value]) => { if (!next || next[property] === undefined) removed.push({ id, property, value }); });
  });
  return { added, removed };
};
