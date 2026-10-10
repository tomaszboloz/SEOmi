import { describe, expect, it } from 'vitest';
import type { CrawledPageSummary } from '@/types';
import { findInternalLinkOpportunities } from '@/services/internalLinkOpportunities';

const page = (url: string, patch: Partial<CrawledPageSummary> = {}): CrawledPageSummary => ({
  url,
  final_url: url,
  redirect_chain: [],
  depth: 1,
  http_status: 200,
  response_time_ms: 100,
  indexability_status: 'Eligible from this response only',
  body_truncated: false,
  word_count: 300,
  semantic_terms: [],
  semantic_links: [],
  schema_types: [],
  schema_syntax_errors: 0,
  hreflangs: [],
  h1_count: 1,
  internal_link_count: 0,
  external_link_count: 0,
  links: [],
  images: [],
  issues_count: 0,
  issues: [],
  ...patch,
});

describe('findInternalLinkOpportunities', () => {
  it('suggests directed pairs from shared bounded content terms, not known content links', () => {
    const a = page('https://example.test/a', { title: 'A', semantic_terms: ['Solar', 'panel', 'guide'] });
    const b = page('https://example.test/b', { title: 'B', semantic_terms: ['solar', 'panel', 'cost'] });
    const report = findInternalLinkOpportunities([a, b]);
    expect(report.eligiblePageCount).toBe(2);
    expect(report.opportunities).toHaveLength(2);
    expect(report.opportunities[0].sharedTerms).toEqual(['panel', 'solar']);
    expect(report.opportunities[0].weightedJaccard).toBeGreaterThan(0.16);
    expect(report.opportunities[0].weightedJaccard).toBeLessThan(1);
  });

  it('removes only the known linked direction and recognizes redirect/final URL aliases', () => {
    const target = page('https://example.test/old', { final_url: 'https://example.test/current', semantic_terms: ['alpha', 'beta'] });
    const source = page('https://example.test/source', {
      semantic_terms: ['alpha', 'beta'],
      semantic_links: [{ target_url: 'https://example.test/old#part', anchor_text: 'existing', is_internal: true }],
    });
    const report = findInternalLinkOpportunities([source, target]);
    expect(report.opportunities).toHaveLength(1);
    expect(report.opportunities[0].sourceUrl).toBe('https://example.test/current');
    expect(report.opportunities[0].targetUrl).toBe('https://example.test/source');
  });

  it('does not treat old, truncated, noindex, non-2xx, or link-cap snapshots as evidence of a missing edge', () => {
    const terms = ['alpha', 'beta'];
    const current = page('https://example.test/current', { semantic_terms: terms });
    const missingLinks = page('https://example.test/old', { semantic_terms: terms, semantic_links: undefined });
    const truncated = page('https://example.test/truncated', { semantic_terms: terms, body_truncated: true });
    const capped = page('https://example.test/capped', { semantic_terms: terms, semantic_links: Array.from({ length: 1000 }, (_, index) => ({ target_url: `https://example.test/${index}`, anchor_text: '', is_internal: true })) });
    const noindex = page('https://example.test/noindex', { semantic_terms: terms, indexability_status: 'Excluded by robots directive' });
    const error = page('https://example.test/error', { semantic_terms: terms, http_status: 503 });
    const report = findInternalLinkOpportunities([current, missingLinks, truncated, capped, noindex, error]);
    expect(report.eligiblePageCount).toBe(1);
    expect(report.pagesWithoutCompleteEvidence).toBe(5);
    expect(report.opportunities).toEqual([]);
  });

  it('reports when the page bound excludes part of the crawl', () => {
    const pages = Array.from({ length: 161 }, (_, index) => page(`https://example.test/${index}`));
    const report = findInternalLinkOpportunities(pages);
    expect(report.pagesOmittedByLimit).toBe(1);
    expect(report.pagesWithoutCompleteEvidence).toBe(160);
  });

  it('relates pages whose shared terms appear in different Polish inflections', () => {
    const a = page('https://example.test/a', { title: 'A', document_language: 'pl', semantic_terms: ['szkolenia', 'navigatora', 'sprzedaży'] });
    const b = page('https://example.test/b', { title: 'B', document_language: 'pl', semantic_terms: ['szkolenie', 'navigator', 'sprzedaż'] });

    const report = findInternalLinkOpportunities([a, b]);

    expect(report.opportunities).toHaveLength(2);
    expect(report.opportunities.find((item) => item.sourceUrl === 'https://example.test/a')?.sharedTerms).toEqual(['navigatora', 'sprzedaży', 'szkolenia']);
  });
});
