import { describe, expect, it } from 'vitest';
import type { CrawledPageSummary, GscPerformanceData } from '@/types';
import { matchParagraphToCrawlSource } from '@/services/briefDocument/evidence';
import { findInternalLinkOpportunities } from '@/services/internalLinkOpportunities';
import { buildTrafficEvidence } from '@/services/semanticGraph/trafficEvidence';
import {
  assertTrendingPayload,
  MAX_TRENDING_PAYLOAD_BYTES,
  trendingEntries,
  trendingSnapshot,
} from '@/services/trendingNow/contracts';

const crawlPage = (url: string, patch: Partial<CrawledPageSummary> = {}): CrawledPageSummary => ({
  url,
  final_url: url,
  redirect_chain: [],
  depth: 0,
  http_status: 200,
  response_time_ms: 1,
  indexability_status: 'indexable',
  body_truncated: false,
  word_count: 20,
  semantic_terms: ['shared alpha', 'shared beta'],
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

describe('coverage edges for bounded evidence contracts', () => {
  it('rejects unsupported and malformed source URLs while retaining valid pairs', () => {
    const valid = crawlPage('https://example.test/valid');
    const ftp = crawlPage('ftp://example.test/ftp');
    const malformed = crawlPage('https://example.test/malformed', { final_url: '://bad' });
    const finalOnly = crawlPage('', { final_url: 'https://example.test/final-only' });
    const requestedOnly = crawlPage('https://example.test/requested-only', { final_url: '' });
    const missingIndexability = crawlPage('https://example.test/no-indexability', { indexability_status: undefined });
    const report = findInternalLinkOpportunities([valid, ftp, malformed, finalOnly, requestedOnly, missingIndexability]);
    expect(report.eligiblePageCount).toBe(3);
    expect(report.pagesWithoutCompleteEvidence).toBe(3);
  });

  it('skips pairs with one shared term and pairs below the weighted threshold', () => {
    const one = crawlPage('https://example.test/one', { semantic_terms: ['shared only', 'one unique'] });
    const two = crawlPage('https://example.test/two', { semantic_terms: ['shared only', 'two unique'] });
    expect(findInternalLinkOpportunities([one, two]).opportunities).toEqual([]);

    const sourceTerms = ['shared alpha', 'shared beta', ...Array.from({ length: 24 }, (_, i) => `source term ${i}`)];
    const targetTerms = ['shared alpha', 'shared beta', ...Array.from({ length: 24 }, (_, i) => `target term ${i}`)];
    const low = findInternalLinkOpportunities([
      crawlPage('https://example.test/low-a', { semantic_terms: sourceTerms }),
      crawlPage('https://example.test/low-b', { semantic_terms: targetTerms }),
    ]);
    expect(low.opportunities).toEqual([]);
  });

  it('matches traffic to the final URL of a requested alias', () => {
    const data: GscPerformanceData = {
      site_url: 'sc-domain:example.test', start_date: '2026-10-01', end_date: '2026-10-02',
      total_clicks: 0, total_impressions: 0, avg_ctr: 0, avg_position: 0,
      queries: [], pages: [{ page: 'https://example.test/final', clicks: 1, impressions: 2, ctr: 0.5, position: 1 }], daily: [],
      queries_may_be_truncated: false, pages_may_be_truncated: false, daily_may_be_truncated: false, max_rows_per_dimension: 10,
    };
    const result = buildTrafficEvidence({
      projectId: 'p', property: 'sc-domain:example.test', startDate: '2026-10-01', endDate: '2026-10-02',
      nodes: [{ id: 'alias', page: { url: 'https://example.test/request', final_url: 'https://example.test/final' } }], gscData: data,
    });
    expect(result.matchedNodeIds).toEqual(['alias']);
    expect(result.nodes[0].metrics.clicks).toBe(1);
  });

  it('reports a non-topical page as no-signal instead of matching its text', () => {
    const page = crawlPage('https://example.test/404', { http_status: 404, final_url: '' });
    expect(matchParagraphToCrawlSource('unrelated claim', page.url, [page])).toMatchObject({
      matched: false, scope: 'no-signal', pageUrl: page.url, overlapPercent: null,
    });
  });
});

describe('trending contracts remaining validation edges', () => {
  it('enforces the UTF-8 payload ceiling', () => {
    expect(() => assertTrendingPayload('x'.repeat(MAX_TRENDING_PAYLOAD_BYTES + 1))).toThrow(/byte limit/);
  });

  it('rejects invalid optional fields and entry values', () => {
    expect(() => trendingEntries([null])).toThrow(/entry/);
    expect(() => trendingEntries([{ keyword: 'term', trafficLabel: 10 }])).toThrow(/text/);
    expect(() => trendingEntries([{ keyword: 'term', trafficLabel: 'x'.repeat(129) }])).toThrow(/text/);
    expect(() => trendingEntries([{ keyword: 'term', startedAt: 'yesterday' }])).toThrow(/start date/);
  });

  it('rejects invalid capture timestamps before validating source rows', () => {
    expect(() => trendingSnapshot('project', 'PL', { kind: 'csv-import', url: null }, [], 'not-a-date')).toThrow(/capture date/);
  });
});
