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

const eligible = (url: string, patch: Partial<CrawledPageSummary> = {}) => page(url, {
  semantic_terms: ['alpha', 'beta'], indexability_status: 'indexable', ...patch,
});

describe('direct internal link evidence boundaries', () => {
  it('rejects malformed/non-HTTP URLs and incomplete or fractional response evidence', () => {
    const pages = [eligible('file:///tmp/a'), eligible('invalid'),
      eligible('https://example.test/a', { http_status: 200.5 }),
      eligible('https://example.test/b', { indexability_status: undefined }),
      eligible('https://example.test/c', { semantic_terms: undefined }),
      eligible('https://example.test/d', { body_truncated: undefined })];
    expect(findInternalLinkOpportunities(pages)).toMatchObject({ eligiblePageCount: 0, pagesWithoutCompleteEvidence: 6, opportunities: [] });
  });
  it('normalizes Unicode terms and fragments and falls back to requested URL/title', () => {
    const a = eligible('https://example.test/a#one', { final_url: '', semantic_terms: ['ＡＬＰＨＡ', ' beta ', '  '] });
    const b = eligible('https://example.test/b', { final_url: '', semantic_terms: ['alpha', 'beta', 'alpha'] });
    const opportunities = findInternalLinkOpportunities([a, b]).opportunities;
    expect(opportunities.map((item) => [item.sourceTitle, item.targetTitle])).toEqual([
      ['https://example.test/a', 'https://example.test/b'], ['https://example.test/b', 'https://example.test/a'],
    ]);
    expect(opportunities.every((item) => item.weightedJaccard === 1)).toBe(true);
    expect(opportunities[0].sharedTerms).toEqual(['alpha', 'beta']);
  });
  it('does not infer suggestions from one shared term or weak weighted overlap', () => {
    expect(findInternalLinkOpportunities([eligible('https://example.test/a'), eligible('https://example.test/b', {
      semantic_terms: ['alpha', 'gamma'],
    })]).opportunities).toEqual([]);
    const terms = (prefix: string) => ['alpha', 'beta', ...Array.from({ length: 38 }, (_, index) => `${prefix}topic${index}`)];
    expect(findInternalLinkOpportunities([eligible('https://example.test/a', { semantic_terms: terms('a') }),
      eligible('https://example.test/b', { semantic_terms: terms('b') })]).opportunities).toEqual([]);
  });
  it('ignores external or invalid captured edges and treats same final URL as one target', () => {
    const a = eligible('https://example.test/a', { semantic_links: [
      { target_url: 'https://example.test/b', anchor_text: '', is_internal: false },
      { target_url: 'invalid', anchor_text: '', is_internal: true },
    ] });
    const b = eligible('https://example.test/b');
    expect(findInternalLinkOpportunities([a, b]).opportunities).toHaveLength(2);
    expect(findInternalLinkOpportunities([a, eligible('https://example.test/alias', { final_url: a.url })]).opportunities).toEqual([]);
  });
  it('caps dense suggestions at 500 and orders equal scores deterministically', () => {
    const pages = Array.from({ length: 24 }, (_, index) => eligible(`https://example.test/${String(index).padStart(2, '0')}`));
    const report = findInternalLinkOpportunities(pages.reverse());
    expect(report.resultsLimited).toBe(true);
    expect(report.opportunities).toHaveLength(500);
    expect(report.opportunities[0].id).toBe('https://example.test/00=>https://example.test/01');
    expect(report.opportunities[1].id).toBe('https://example.test/00=>https://example.test/02');
  });
});
