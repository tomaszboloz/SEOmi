import { describe, expect, it } from 'vitest';
import type { CrawledPageSummary } from '@/types';
import { matchParagraphToCrawlSource } from '@/services/contentBrief';
import { buildSemanticAudit } from '@/services/semanticAudit';
import { createEmptyTopicalMap } from '@/services/topicalMap';
import { termCoverage, termsFor } from '@/services/topicalAudit/evidence';
import { page, topic } from './fixtures/semanticAuditContracts';

describe('Polish inflection in semantic evidence', () => {
  it('matches source terms to a paragraph that uses other Polish inflections', () => {
    const sourcePages = [{
      url: 'https://site.test/oferta', final_url: 'https://site.test/oferta', title: 'Oferta', document_language: 'pl',
      semantic_terms: ['szkolenia', 'navigatora', 'sprzedaży', 'konsultacje'],
    }] as unknown as CrawledPageSummary[];

    const result = matchParagraphToCrawlSource('Szkolenie z Navigator dla działu sprzedaży i jedna konsultacja.', 'https://site.test/oferta', sourcePages);

    expect(result).toMatchObject({ matched: true, scope: 'semantic-terms' });
    expect(result.matchedTerms).toEqual(['szkolenia', 'navigatora', 'sprzedaży', 'konsultacje']);
  });

  it('keys audited page terms by inflection and keeps the first observed form', () => {
    const offer = page('https://site.test/oferta', ['Szkolenia', 'szkolenie', 'sprzedaży'], { document_language: 'pl' });

    expect([...termsFor(offer)]).toEqual([['pl:szkolen', 'szkolenia'], ['pl:sprzedaz', 'sprzedaży']]);
    expect(termCoverage('szkoleniem sprzedaż wideo', offer)).toEqual({ expected: ['szkoleniem', 'sprzedaz', 'wideo'], matched: ['szkoleniem', 'sprzedaz'] });
  });

  it('counts a query token as observed when the page uses another inflection of it', () => {
    const document = createEmptyTopicalMap();
    document.nodes = [topic(['https://site.test/oferta'], [{ id: 'q1', text: 'szkolenie sales navigator', provenance: 'asserted' }])];

    const report = buildSemanticAudit(document, [page('https://site.test/oferta', ['szkolenia', 'sales', 'navigatora'], { document_language: 'pl' })]);

    expect(report.findings.some((item) => item.code === 'query-not-observed')).toBe(false);
  });

  it('flags possible overlap between same-topic pages that use different inflections', () => {
    const document = createEmptyTopicalMap();
    document.nodes = [topic(['https://site.test/a', 'https://site.test/b'])];
    const pages = [
      page('https://site.test/a', ['szkolenia', 'navigatora', 'sprzedaży', 'konsultacje'], { document_language: 'pl' }),
      page('https://site.test/b', ['szkolenie', 'navigator', 'sprzedaż', 'konsultacja'], { document_language: 'pl' }),
    ];

    const overlap = buildSemanticAudit(document, pages).findings.filter((item) => item.code === 'possible-url-overlap');

    expect(overlap).toHaveLength(1);
  });
});
