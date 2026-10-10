import { describe, expect, it } from 'vitest';
import type { CrawlRunRecord } from '@/types';
import { matchAiCitationToCrawl } from '@/services/aiCitationEvidence';

const run = (pages: Array<Record<string, unknown>>) => ({
  id: 'crawl-one',
  completedAt: '2026-09-23T10:00:00.000Z',
  startUrl: 'https://example.test/',
  config: {},
  result: { pages_crawled: pages.length, pages },
}) as unknown as CrawlRunRecord;

describe('AI citation crawl evidence', () => {
  it('matches direct and final URLs from the selected snapshot while ignoring fragments', () => {
    const snapshot = run([{ url: 'https://example.test/old', final_url: 'https://example.test/new', title: 'Page title', semantic_terms: ['coffee', 'beans'], http_status: 200, indexability_status: 'Eligible from this response only', redirect_chain: [] }]);
    expect(matchAiCitationToCrawl('https://example.test/new#section', snapshot)).toMatchObject({
      normalizedUrl: 'https://example.test/new', matched: true, matchKind: 'final_url',
      page: { title: 'Page title', http_status: 200 },
    });
    expect(matchAiCitationToCrawl('https://example.test/old', snapshot).matchKind).toBe('request_url');
  });

  it('reports bounded lexical source context without claiming citation correctness', () => {
    const excerpt = 'A practical coffee guide for beans and grinder selection helps readers compare options.';
    const snapshot = run([{ url: 'https://example.test/page', final_url: 'https://example.test/page', title: 'Coffee guide', semantic_terms: ['coffee', 'beans', 'grinder'], semantic_excerpts: [excerpt], http_status: 200, indexability_status: 'index', redirect_chain: [] }]);
    expect(matchAiCitationToCrawl('https://example.test/page', snapshot, excerpt)).toMatchObject({
      matched: true,
      context: { scope: 'sentence-match', matchedTerms: ['coffee', 'beans', 'grinder'], meetsMinimum: true, excerptMatch: true, sentenceMatch: true, sentenceOverlapPercent: 100, matchedExcerpt: excerpt },
    });
    const exactEvidence = matchAiCitationToCrawl('https://example.test/page', snapshot, excerpt).context;
    expect(exactEvidence?.responseSpan).toMatchObject({ start: 0, end: excerpt.length - 1, source: 'response' });
    expect(exactEvidence?.sourceSpan).toMatchObject({ start: 0, end: excerpt.length, source: 'semantic-excerpt' });
    expect(exactEvidence?.matchedTermEvidence).toEqual([
      { term: 'practical', response: { start: 2, end: 11 }, source: { start: 2, end: 11 } },
      { term: 'coffee', response: { start: 12, end: 18 }, source: { start: 12, end: 18 } },
      { term: 'guide', response: { start: 19, end: 24 }, source: { start: 19, end: 24 } },
      { term: 'beans', response: { start: 29, end: 34 }, source: { start: 29, end: 34 } },
      { term: 'grinder', response: { start: 39, end: 46 }, source: { start: 39, end: 46 } },
      { term: 'selection', response: { start: 47, end: 56 }, source: { start: 47, end: 56 } },
      { term: 'helps', response: { start: 57, end: 62 }, source: { start: 57, end: 62 } },
      { term: 'readers', response: { start: 63, end: 70 }, source: { start: 63, end: 70 } },
      { term: 'compare', response: { start: 71, end: 78 }, source: { start: 71, end: 78 } },
      { term: 'options', response: { start: 79, end: 86 }, source: { start: 79, end: 86 } },
    ]);
    expect(matchAiCitationToCrawl('https://example.test/page', snapshot, 'This coffee guide helps readers compare beans and grinder options.').context).toMatchObject({ sentenceMatch: true, scope: 'sentence-match' });
    expect(matchAiCitationToCrawl('https://example.test/page', snapshot, 'An unrelated answer.').context?.meetsMinimum).toBe(false);
  });

  it('matches redirect aliases and trims sentence punctuation only when the crawl has the trimmed URL', () => {
    const snapshot = run([{ url: 'https://example.test/start', final_url: 'https://example.test/end', title: 'Redirected', http_status: 200, indexability_status: 'Eligible from this response only', redirect_chain: [{ from_url: 'https://example.test/start', http_status: 301, to_url: 'https://example.test/end' }] }]);
    expect(matchAiCitationToCrawl('https://example.test/end.', snapshot).matched).toBe(true);
    expect(matchAiCitationToCrawl('https://example.test/end.', snapshot).matchKind).toBe('final_url');
    expect(matchAiCitationToCrawl('https://example.test/end.', run([{ url: 'https://example.test/end.', final_url: 'https://example.test/end.', http_status: 200, redirect_chain: [] }])).matchKind).toBe('request_url');
  });

  it('reports crawled HTTP errors as recorded and never treats an absent URL as broken', () => {
    const snapshot = run([{ url: 'https://example.test/missing', final_url: 'https://example.test/missing', http_status: 404, indexability_status: 'Blocked by HTTP error', redirect_chain: [] }]);
    expect(matchAiCitationToCrawl('https://example.test/missing', snapshot)).toMatchObject({ matched: true, page: { http_status: 404 } });
    expect(matchAiCitationToCrawl('https://outside.test/page', snapshot)).toMatchObject({ matched: false, normalizedUrl: 'https://outside.test/page' });
  });

  it('leaves invalid URLs and results without a chosen crawl unverified', () => {
    expect(matchAiCitationToCrawl('javascript:alert(1)', run([]))).toMatchObject({ matched: false, normalizedUrl: null });
    expect(matchAiCitationToCrawl('https://example.test/page', null)).toMatchObject({ matched: false, normalizedUrl: 'https://example.test/page' });
  });

  it('matches Polish page terms to a response that uses other inflections of them', () => {
    const snapshot = run([{ url: 'https://example.test/oferta', final_url: 'https://example.test/oferta', title: 'Oferta', document_language: 'pl', semantic_terms: ['szkolenia', 'navigatora', 'sprzedaży'], http_status: 200, indexability_status: 'index', redirect_chain: [] }]);
    const context = matchAiCitationToCrawl('https://example.test/oferta', snapshot, 'Szkolenie z Sales Navigator poprawia wyniki sprzedaży.').context;

    expect(context?.matchedTerms).toEqual(['szkolenia', 'navigatora', 'sprzedaży']);
    expect(context?.matchedTermEvidence.find((item) => item.term === 'szkolenia')?.response).toEqual({ start: 0, end: 9 });
  });

  it('does not claim semantic context for an error page that retained legacy terms', () => {
    const snapshot = run([{ url: 'https://example.test/missing', final_url: 'https://example.test/missing', title: 'Coffee', semantic_terms: ['coffee', 'beans'], http_status: 404, indexability_status: 'Blocked by HTTP error', redirect_chain: [] }]);
    expect(matchAiCitationToCrawl('https://example.test/missing', snapshot, 'Coffee beans are useful.').context).toMatchObject({
      scope: 'no-content-signal', meetsMinimum: false, matchedTerms: [], sourceTermCount: 0,
    });
  });
});
