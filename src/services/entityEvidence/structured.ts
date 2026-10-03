import type { CrawledPageSummary } from '@/types';
import i18n from '@/i18n';
import { MAX_SCHEMA_TYPES, MAX_SCHEMA_REFERENCE_NODES, schemaTypeLabel } from './text';
import { ensurePageNode, reserveEvidenceEdge, type EvidenceState } from './state';

export const addStructuredEvidence = (state: EvidenceState, pages: CrawledPageSummary[]): void => {
  pages.forEach((page, pageIndex) => {
    const allTypes = [...new Set((page.schema_types ?? []).map(schemaTypeLabel).filter(Boolean))];
    const allReferences = page.schema_references ?? [];
    if (allTypes.length > MAX_SCHEMA_TYPES || allReferences.length > MAX_SCHEMA_REFERENCE_NODES) state.truncated = true;
    const types = allTypes.slice(0, MAX_SCHEMA_TYPES);
    const references = allReferences.slice(0, MAX_SCHEMA_REFERENCE_NODES);
    if (!types.length && !references.length) return;
    state.structuredPageIndexes.add(pageIndex);
    const pageNodeId = ensurePageNode(state, page, pageIndex);
    types.forEach((type) => {
      const id = `schema:${type.toLocaleLowerCase()}`;
      if (state.schemaNodeIds.size >= MAX_SCHEMA_TYPES && !state.schemaNodeIds.has(id)) {
        state.truncated = true;
        return;
      }
      if (!state.schemaNodeIds.has(id)) {
        state.schemaNodeIds.add(id);
        state.nodes.push({
          id, kind: 'schema', label: type,
          detail: i18n.t('componentUi.schemaDeclaredInCrawl'), provenance: 'measured',
        });
      }
      if (!reserveEvidenceEdge(state)) return;
      state.edges.push({
        id: `${pageNodeId}->${id}`, source: pageNodeId, target: id,
        kind: 'structured', matchedTerms: [], coverage: null,
        evidence: i18n.t('componentUi.schemaEvidence', { type }),
      });
    });
    references.forEach((reference, referenceIndex) => {
      if (state.schemaReferenceNodeIds.size >= MAX_SCHEMA_REFERENCE_NODES) {
        state.truncated = true;
        return;
      }
      if (!reserveEvidenceEdge(state)) return;
      const id = `schema-ref:${pageIndex}:${referenceIndex}`;
      state.schemaReferenceNodeIds.add(id);
      state.nodes.push({
        id, kind: 'schema', label: `${reference.property}: ${reference.value}`,
        detail: i18n.t('componentUi.schemaReferenceDetail', { format: reference.format, index: reference.declaration_index }),
        provenance: 'measured',
      });
      state.edges.push({
        id: `${pageNodeId}->${id}`, source: pageNodeId, target: id,
        kind: 'reference', matchedTerms: [], coverage: null,
        evidence: i18n.t('componentUi.schemaReferenceEvidence', { property: reference.property, value: reference.value }),
      });
    });
  });
};
