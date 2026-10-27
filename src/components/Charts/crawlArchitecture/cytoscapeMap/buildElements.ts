import type { ElementDefinition } from 'cytoscape';
import type { MapEdge, MapNode } from './mapTypes';
import { nodeColor, nodeSize } from './nodeStyle';
import { LABEL_LIMIT, remapEdges, sectionCounts, sectionId } from './sections';

export interface ElementOptions {
  /** Compound parents for expanded sections (force layout only). */
  grouped: boolean;
  collapsed: ReadonlySet<string>;
}

const shortLabel = (url: string): string => {
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}`.slice(0, 34) || '/';
  } catch {
    return url.slice(0, 34);
  }
};

/** Only the most linked pages get a permanent label; the rest rely on tooltips. */
const labelledIds = (nodes: MapNode[]): Set<string> =>
  new Set([...nodes].sort((a, b) => b.inlinks - a.inlinks).slice(0, LABEL_LIMIT).map((node) => node.id));

export const buildElements = (nodes: MapNode[], edges: MapEdge[], options: ElementOptions): ElementDefinition[] => {
  const counts = sectionCounts(nodes);
  const labelled = labelledIds(nodes);
  const elements: ElementDefinition[] = [];
  const emitted = new Set<string>();
  nodes.forEach((node) => {
    const multi = (counts.get(node.section) ?? 0) > 1;
    if (multi && options.collapsed.has(node.section)) {
      const id = sectionId(node.section);
      if (emitted.has(id)) return;
      emitted.add(id);
      const count = counts.get(node.section)!;
      elements.push({ group: 'nodes', data: { id, kind: 'section', label: `${node.section} (${count})`, size: Math.round(Math.min(18 + Math.sqrt(count) * 4, 54)), color: '#475569', section: node.section } });
      return;
    }
    const parent = options.grouped && multi ? sectionId(node.section) : undefined;
    if (parent && !emitted.has(parent)) {
      emitted.add(parent);
      elements.push({ group: 'nodes', data: { id: parent, kind: 'group', label: node.section, section: node.section } });
    }
    elements.push({ group: 'nodes', data: { id: node.id, kind: 'page', label: labelled.has(node.id) ? shortLabel(node.url) : '', size: nodeSize(node.inlinks), color: nodeColor(node), section: node.section, ...(parent ? { parent } : {}) } });
  });
  remapEdges(edges, nodes, options.collapsed).forEach((edge) => {
    elements.push({ group: 'edges', data: { id: edge.id, source: edge.source, target: edge.target, weight: Math.min(1 + Math.log2(edge.links), 4) } });
  });
  return elements;
};
