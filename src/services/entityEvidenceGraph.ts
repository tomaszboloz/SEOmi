import type { CrawledPageSummary } from '@/types';
import type { TopicalMapDocument } from '@/services/topicalMap';
import i18n from '@/i18n';
import type { EntityEvidenceGraph } from './entityEvidence/types';
import { MAX_PAGES, MAX_FACTS, normalize } from './entityEvidence/text';
import { createEvidenceState } from './entityEvidence/state';
import { addStructuredEvidence } from './entityEvidence/structured';
import { entityAssertions, addAssertionEvidence } from './entityEvidence/assertions';

export type {
  EntityEvidenceNodeKind, EntityEvidenceEdgeKind, EntityEvidenceNode, EntityEvidenceEdge, EntityEvidenceGraph,
} from './entityEvidence/types';

/**
 * Entity attributes are owner assertions; crawl edges prove bounded lexical
 * observability only. This graph does not recognize entities or infer facts.
 */
export const buildEntityEvidenceGraph = (
  document: TopicalMapDocument, pages: CrawledPageSummary[],
): EntityEvidenceGraph => {
  const name = document.entity.name.trim();
  if (!name) {
    return { nodes: [], edges: [], entityNodeId: null, comparablePages: 0, structuredPages: 0,
      schemaTypes: 0, observedAssertions: 0, totalAssertions: 0, truncated: false };
  }
  const selectedPages = pages.slice(0, MAX_PAGES);
  const assertions = entityAssertions(document);
  const entityNodeId = 'entity:project';
  const state = createEvidenceState({
    id: entityNodeId, kind: 'entity', label: name,
    detail: document.entity.description.trim() || i18n.t('runtimeErrors.entity.declared'), provenance: 'asserted',
  }, assertions.length);
  addStructuredEvidence(state, selectedPages);
  const observedAssertions = addAssertionEvidence(state, assertions, selectedPages, entityNodeId);
  return {
    nodes: state.nodes, edges: state.edges, entityNodeId,
    comparablePages: selectedPages.filter((page) => (page.semantic_terms ?? []).some((term) => normalize(term))).length,
    structuredPages: state.structuredPageIndexes.size, schemaTypes: state.schemaNodeIds.size,
    observedAssertions, totalAssertions: assertions.length,
    truncated: state.truncated || pages.length > MAX_PAGES || document.entity.facts.length > MAX_FACTS,
  };
};
