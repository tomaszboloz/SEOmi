import { describe, expect, it } from 'vitest';
import { auditPageEvidence } from '@/services/topicalAudit/pages';
import { auditEntityObservability } from '@/services/topicalAudit/entity';
import { page, topic } from './fixtures/semanticAuditContracts';
import { auditContext } from './fixtures/topicalAuditContext';

describe('page and owner entity evidence stages', () => {
  it('reports multiple editorial assignments without rewriting them', () => {
    const pages = [page('https://site.test/a', ['coffee'], { semantic_excerpts: ['Measured excerpt'] })];
    const context = auditContext(pages, [topic([pages[0].url]), { ...topic([pages[0].url]), id: 'second' }]);
    auditPageEvidence(context);
    expect(context.findings).toEqual([expect.objectContaining({ code: 'ambiguous-page',
      provenance: ['asserted', 'measured'], evidence: ['Coffee', 'Coffee'], urls: [pages[0].url] })]);
  });

  it('keeps missing content excerpts a limited notice and measured truncation a review', () => {
    const pages = [page('https://site.test/a', []), page('https://site.test/b', [], { body_truncated: true }),
      { ...page('https://site.test/c', []), semantic_terms: undefined }];
    const context = auditContext(pages);
    context.topicsByPage.clear();
    auditPageEvidence(context);
    expect(context.findings.filter((finding) => finding.code === 'content-evidence-partial').map((finding) => finding.severity))
      .toEqual(['notice', 'review', 'notice']);
    expect(context.findings.filter((finding) => finding.code === 'unassigned-page')).toHaveLength(3);
  });

  it('observes fact values independently from punctuation in asserted labels', () => {
    const context = auditContext([page('https://site.test/a', ['warsaw']), page('https://site.test/b', ['acme', 'warsaw']),
      page('https://site.test/blank', ['!!!', ' '])]);
    context.document.entity.name = 'Acme: Warsaw';
    context.document.entity.facts = [{ id: 'city', attribute: 'Location: HQ', value: 'Warsaw', sourceUrl: '', reuseStatus: 'locked' }];
    expect(auditEntityObservability(context)).toEqual([
      { label: 'Acme: Warsaw', observedPages: 1, comparablePages: 2, provenance: 'asserted+measured' },
      { label: 'Location: HQ: Warsaw', observedPages: 2, comparablePages: 2, provenance: 'asserted+measured' },
    ]);
    expect(context.findings).toEqual([]);
  });

  it('keeps absent and tokenless assertions limited without inventing observations', () => {
    const context = auditContext([page('https://site.test/a', ['coffee'])]);
    context.document.entity.name = 'a';
    expect(auditEntityObservability(context)[0]).toMatchObject({ observedPages: 0, comparablePages: 1 });
    expect(context.findings[0]).toMatchObject({ code: 'entity-not-observed', confidence: 'limited' });
    expect(auditEntityObservability(auditContext())).toEqual([]);
  });
});
