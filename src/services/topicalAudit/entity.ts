import type { TopicalAuditContext } from './types';
import { addFinding, semanticText, termCoverage, termsFor } from './evidence';

export const auditEntityObservability = (context: TopicalAuditContext) => {
  const { document, pages, findings } = context;
  const entityAssertions = [
    ...(document.entity.name.trim() ? [{ label: document.entity.name, value: document.entity.name, kind: semanticText('entityNameKind') }] : []),
    ...document.entity.facts.map((fact) => ({ label: `${fact.attribute}: ${fact.value}`, value: fact.value, kind: semanticText('kindAsserted', { value: fact.attribute }) })),
  ];
  const entityObservability = entityAssertions.map(({ label, value, kind }) => {
    const comparable = pages.filter((page) => [...termsFor(page).values()].some((term) => /[\p{L}\p{N}]/u.test(term)));
    const observedPages = comparable.filter((page) => {
      const coverage = termCoverage(value, page);
      return Boolean(coverage?.expected.length && coverage.expected.every((term) => coverage.matched.includes(term)));
    });
    if (comparable.length && !observedPages.length) addFinding(findings, {
      id: `entity-unobserved-${kind}-${label}`.slice(0, 240), code: 'entity-not-observed', severity: 'review',
      provenance: ['asserted', 'measured', 'derived'], title: semanticText('entityTitle', { kind }),
      detail: semanticText('entityDetail'),
      urls: comparable.slice(0, 20).map((page) => page.url), evidence: [semanticText('declaration', { value: label }), semanticText('comparedPages', { count: comparable.length })], confidence: 'limited',
    });
    return { label, observedPages: observedPages.length, comparablePages: comparable.length, provenance: 'asserted+measured' as const };
  });

  return entityObservability;
};
