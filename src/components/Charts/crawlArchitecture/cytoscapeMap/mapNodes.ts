import type { SemanticPageNode } from '@/services/semanticMap';
import type { MapFilters, MapNode, StatusClass, MapEdge } from './mapTypes';

/** TRS below this value counts as a problem (matches the Site Focus content guard). */
export const LOW_TRS = 40;

export const statusClassOf = (status: number): StatusClass => {
  if (status >= 200 && status < 300) return '2xx';
  if (status >= 300 && status < 400) return '3xx';
  if (status >= 400 && status < 500) return '4xx';
  return status >= 500 && status < 600 ? '5xx' : 'other';
};

/** First path segment groups URLs into a section; the root and unparsable URLs share "/". */
export const sectionOf = (url: string): string => {
  try {
    const segment = new URL(url).pathname.split('/').filter(Boolean)[0];
    return segment ? `/${segment}` : '/';
  } catch {
    return '/';
  }
};

export const buildMapNodes = (nodes: SemanticPageNode[], trsByUrl: Record<string, number>): MapNode[] =>
  nodes.map((node) => {
    const { page } = node;
    const trs = trsByUrl[page.url] ?? trsByUrl[page.final_url] ?? null;
    const status = page.http_status;
    return {
      id: node.id,
      url: page.url,
      title: page.title ?? '',
      status,
      statusClass: statusClassOf(status),
      depth: page.depth,
      inlinks: node.incomingContentLinks,
      trs,
      section: sectionOf(page.url),
      orphan: node.orphan,
      problem: status >= 300 || node.orphan || (trs !== null && trs < LOW_TRS),
    };
  });

export const applyMapFilters = (nodes: MapNode[], filters: MapFilters): MapNode[] =>
  nodes.filter((node) =>
    filters.statuses.includes(node.statusClass)
    && (filters.maxDepth === null || node.depth <= filters.maxDepth)
    && (!filters.problemsOnly || node.problem));

export const keepEdges = (edges: MapEdge[], nodes: MapNode[]): MapEdge[] => {
  const ids = new Set(nodes.map((node) => node.id));
  return edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target));
};

export const matchIds = (nodes: MapNode[], query: string): Set<string> => {
  const needle = query.trim().toLowerCase();
  if (!needle) return new Set();
  return new Set(nodes.filter((node) => `${node.url} ${node.title}`.toLowerCase().includes(needle)).map((node) => node.id));
};

export const maxDepthOf = (nodes: MapNode[]): number => nodes.reduce((max, node) => Math.max(max, node.depth), 0);
