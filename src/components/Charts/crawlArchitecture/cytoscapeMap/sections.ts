import type { MapEdge, MapNode } from './mapTypes';

/** Above this many pages every multi-page section starts collapsed. */
export const COLLAPSE_THRESHOLD = 600;
export const LABEL_LIMIT = 60;

export const sectionId = (section: string): string => `sec:${section}`;

export const sectionCounts = (nodes: MapNode[]): Map<string, number> => {
  const counts = new Map<string, number>();
  nodes.forEach((node) => counts.set(node.section, (counts.get(node.section) ?? 0) + 1));
  return counts;
};

/**
 * Sections collapsed by default on big sites (progressive collapsing); `toggled`
 * holds the sections the user flipped away from that default.
 */
export const resolveCollapsed = (nodes: MapNode[], toggled: ReadonlySet<string>): Set<string> => {
  const big = nodes.length > COLLAPSE_THRESHOLD;
  const collapsed = new Set<string>();
  sectionCounts(nodes).forEach((count, section) => {
    if (count > 1 && big !== toggled.has(section)) collapsed.add(section);
  });
  return collapsed;
};

export const allSections = (nodes: MapNode[]): string[] =>
  [...sectionCounts(nodes)].filter(([, count]) => count > 1).map(([section]) => section);

/** Edges re-pointed at collapsed section nodes, self loops dropped, parallel edges merged. */
export const remapEdges = (edges: MapEdge[], nodes: MapNode[], collapsed: ReadonlySet<string>): MapEdge[] => {
  const rep = new Map(nodes.map((node) => [node.id, collapsed.has(node.section) ? sectionId(node.section) : node.id]));
  const merged = new Map<string, MapEdge>();
  edges.forEach((edge) => {
    const source = rep.get(edge.source)!;
    const target = rep.get(edge.target)!;
    if (source === target) return;
    const key = `${source}->${target}`;
    const previous = merged.get(key);
    merged.set(key, { id: key, source, target, links: (previous?.links ?? 0) + edge.links });
  });
  return [...merged.values()];
};
