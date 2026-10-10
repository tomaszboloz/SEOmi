import type { TopicalAuditContext } from './types';
import { addFinding, semanticText, termCoverage, termsFor, normalizedProviderIntent } from './evidence';

export const auditQueryEvidence = (context: TopicalAuditContext) => {
  const { document, pagesByTopic, findings } = context;
  for (const node of document.nodes) {
    const topicPages = pagesByTopic.get(node.id) ?? [];
    for (const query of node.queries) {
      for (const page of topicPages) {
        const coverage = termCoverage(query.text, page);
        if (!coverage || coverage.matched.length === coverage.expected.length) continue;
        const coveragePercent = Math.round(coverage.matched.length / coverage.expected.length * 100);
        addFinding(findings, {
          id: `query-unobserved-${node.id}-${query.id}-${page.url}`, code: 'query-not-observed', severity: 'notice',
          provenance: ['asserted', 'measured', 'derived'], title: semanticText('querySignal', { prefix: coveragePercent ? semanticText('partial') : semanticText('none'), query: query.text }),
          detail: semanticText('querySignalDetail', { matched: coverage.matched.length, expected: coverage.expected.length, percent: coveragePercent }),
          urls: [page.url], topicId: node.id, evidence: [semanticText('query', { provenance: query.provenance, value: query.text }), semanticText('matchedTokens', { value: coverage.matched.join(', ') || semanticText('missingTerm') }), semanticText('missingTokens', { value: coverage.expected.filter((term) => !coverage.matched.includes(term)).join(', ') }), semanticText('contentTerms', { value: [...termsFor(page).values()].slice(0, 8).join(', ') || semanticText('missingTerm') })], confidence: 'limited',
        });
      }
    }
  }

  // DataForSEO intent is provider evidence for the imported query, while the
  // topical-node intent is an explicit editorial declaration. Surface a
  // review signal when they disagree; never silently rewrite the declaration
  // or present this as a ranking/cannibalization verdict.
  for (const node of document.nodes) {
    if (node.intent === 'unknown' || node.intent === 'mixed') continue;
    for (const query of node.queries) {
      const source = query.source;
      const observedIntent = source && 'searchIntent' in source
        ? normalizedProviderIntent(source.searchIntent)
        : null;
      if (!observedIntent || observedIntent === node.intent) continue;
      addFinding(findings, {
        id: `query-intent-mismatch-${node.id}-${query.id}`.slice(0, 240),
        code: 'query-intent-mismatch',
        severity: 'review',
        provenance: ['asserted', 'measured', 'derived'],
        title: semanticText('intentMismatchTitle', { query: query.text }),
        detail: semanticText('intentMismatchDetail'),
        urls: (pagesByTopic.get(node.id) ?? []).slice(0, 20).map((page) => page.url),
        topicId: node.id,
        evidence: [
          semanticText('intentExpected', { value: node.intent }),
          semanticText('intentObserved', { value: observedIntent }),
          semanticText('query', { provenance: query.provenance, value: query.text }),
          semanticText('intentSource', { value: source?.retrievedAt ?? semanticText('unknown') }),
        ],
        confidence: 'moderate',
      });
    }
  }

};
