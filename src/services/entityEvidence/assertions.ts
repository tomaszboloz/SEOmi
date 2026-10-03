import type { CrawledPageSummary } from '@/types';
import type { TopicalEntityFact, TopicalMapDocument } from '@/services/topicalMap';
import i18n from '@/i18n';
import { MAX_FACTS, assertionLabel, tokens, coverageFor } from './text';
import { ensurePageNode, reserveEvidenceEdge, type EvidenceState } from './state';

export interface EntityAssertion {
  id: string;
  label: string;
  terms: string[];
  fact?: TopicalEntityFact;
}

export const entityAssertions = (document: TopicalMapDocument): EntityAssertion[] => [
  { id: 'entity:name', label: document.entity.name.trim(), terms: tokens(document.entity.name) },
  ...document.entity.facts.slice(0, MAX_FACTS).map((fact) => ({
    id: `fact:${fact.id}`, label: assertionLabel(fact), terms: tokens(fact.value), fact,
  })),
];

export const addAssertionEvidence = (
  state: EvidenceState, assertions: EntityAssertion[], pages: CrawledPageSummary[], entityNodeId: string,
): number => {
  let observedAssertions = 0;
  assertions.forEach((assertion) => {
    const fact = assertion.fact;
    const nodeId = assertion.id;
    state.nodes.push({
      id: nodeId, kind: 'fact', label: assertion.label,
      detail: fact?.sourceUrl ? i18n.t('runtimeErrors.entity.source', { url: fact.sourceUrl })
        : fact ? i18n.t('runtimeErrors.entity.withoutSource') : i18n.t('runtimeErrors.entity.name'),
      provenance: 'asserted',
    });
    state.edges.push({
      id: `${entityNodeId}->${nodeId}`, source: entityNodeId, target: nodeId,
      kind: 'declared', matchedTerms: assertion.terms, coverage: null,
      evidence: fact ? i18n.t('runtimeErrors.entity.declaredAttribute', { attribute: fact.attribute })
        : i18n.t('runtimeErrors.entity.declaredName'),
    });
    let assertionObserved = false;
    pages.forEach((page, index) => {
      const result = coverageFor(assertion.terms, page);
      if (!result || result.coverage < 0.25) return;
      assertionObserved = assertionObserved || result.coverage === 1;
      if (!reserveEvidenceEdge(state)) return;
      const pageNodeId = ensurePageNode(state, page, index);
      state.edges.push({
        id: `${nodeId}->${pageNodeId}`, source: nodeId, target: pageNodeId,
        kind: 'observed', matchedTerms: result.matched.slice(0, 8), coverage: result.coverage,
        evidence: i18n.t('runtimeErrors.entity.terms', { matched: result.matched.length, total: assertion.terms.length }),
      });
    });
    if (assertionObserved) observedAssertions += 1;
  });
  return observedAssertions;
};
