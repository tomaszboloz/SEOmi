import type { CrawledPageSummary } from '@/types';
import type { EntityEvidenceEdge, EntityEvidenceNode } from './types';
import { MAX_EDGES, pageUrl } from './text';

export interface EvidenceState {
  nodes: EntityEvidenceNode[];
  edges: EntityEvidenceEdge[];
  pageNodeIds: Set<string>;
  schemaNodeIds: Set<string>;
  schemaReferenceNodeIds: Set<string>;
  structuredPageIndexes: Set<number>;
  evidenceEdgeLimit: number;
  evidenceEdgeCount: number;
  truncated: boolean;
}

export const createEvidenceState = (entity: EntityEvidenceNode, assertions: number): EvidenceState => ({
  nodes: [entity], edges: [], pageNodeIds: new Set(), schemaNodeIds: new Set(),
  schemaReferenceNodeIds: new Set(), structuredPageIndexes: new Set(),
  evidenceEdgeLimit: MAX_EDGES - assertions, evidenceEdgeCount: 0, truncated: false,
});

export const ensurePageNode = (state: EvidenceState, page: CrawledPageSummary, index: number): string => {
  const id = `page:${index}`;
  if (!state.pageNodeIds.has(id)) {
    state.pageNodeIds.add(id);
    state.nodes.push({
      id, kind: 'page', label: page.title?.trim() || pageUrl(page),
      detail: pageUrl(page), url: pageUrl(page), provenance: 'measured',
    });
  }
  return id;
};

/** Reserve one declaration per assertion even when crawl evidence fills its budget. */
export const reserveEvidenceEdge = (state: EvidenceState): boolean => {
  if (state.evidenceEdgeCount < state.evidenceEdgeLimit) {
    state.evidenceEdgeCount += 1;
    return true;
  }
  state.truncated = true;
  return false;
};
