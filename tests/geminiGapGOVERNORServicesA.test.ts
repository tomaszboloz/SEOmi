import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import i18n from '@/i18n';
import { useTrust } from '@/hooks/useTrust';
import { findInternalLinkOpportunities } from '@/services/internalLinkOpportunities';
import * as monitoringAlerts from '@/services/monitoringAlerts';
import type { CrawledPageSummary, CrawledSchemaReference } from '@/types';
import { createCrawlPageFixture, createCrawlRunFixture } from './fixtures/crawl';

type SchemaRef = CrawledSchemaReference & { node_path?: string };
const schemaRef = (node_path: string, property: string, value: string): SchemaRef => ({ format: 'JSON-LD', declaration_index: 0, node_path, property, value });

vi.mock('@/services/monitoringAlerts', () => ({
  monitorScoreDrop: vi.fn(),
}));

vi.mock('@/services/siteFocus', () => ({
  buildSiteFocusReport: vi.fn().mockReturnValue({ pages: [], coreTopic: { label: '', terms: [] }, model: { language: 'en', coreWeights: {} } }),
}));

vi.mock('@/services/semanticText', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/semanticText')>()),
  semanticPageTermInventory: vi.fn((page: CrawledPageSummary) => {
    if (page.url.includes('p1') || page.url.includes('p2') || page.url.includes('p3')) {
      return new Map([['termA', 'termA'], ['termB', 'termB'], ['termC', 'termC']]);
    }
    return new Map();
  }),
}));

beforeEach(async () => {
  await i18n.changeLanguage('en');
  vi.restoreAllMocks();
});

describe('geminiGapGOVERNORServicesA: useTrust and internalLinkOpportunities', () => {
  it('covers useTrust line 26 score drop dispatch, catch handler and duplicate run bypass', async () => {
    const dummyPage = createCrawlPageFixture({
      url: 'https://example.com/p', final_url: 'https://example.com/p', title: 'Diabetes treatment', schema_types: ['Article'],
      schema_references: [
        schemaRef('$', '@type', 'Article'), schemaRef('$', 'author', 'https://example.com/authors/anna'),
        schemaRef('$.author', '@id', 'https://example.com/authors/anna'), schemaRef('$.author', '@type', 'Person'),
        schemaRef('$.author', 'name', 'Anna Nowak'), schemaRef('$.author', 'description', 'Diabetes physician'),
      ],
    }) as CrawledPageSummary;
    const weakPage = { ...dummyPage, schema_references: [schemaRef('$', '@type', 'Article')] };
    const run1 = createCrawlRunFixture({ id: 'run-100', completedAt: '2026-01-01T00:00:00Z', startUrl: 'https://example.com/', result: { ...createCrawlRunFixture().result, pages: [dummyPage], pages_crawled: 1 } });
    const run2 = createCrawlRunFixture({ id: 'run-101', completedAt: '2026-01-02T00:00:00Z', startUrl: 'https://example.com/', result: { ...run1.result, pages: [weakPage], pages_crawled: 1 } });

    const dropSpy = vi.spyOn(monitoringAlerts, 'monitorScoreDrop').mockRejectedValue(new Error('dispatch fail'));

    const h1 = renderHook(() => useTrust([dummyPage], 'https://example.com', run1, 'proj-1'));
    expect(dropSpy).not.toHaveBeenCalled();
    h1.unmount();

    const h2 = renderHook(() => useTrust([weakPage], 'https://example.com', run2, 'proj-1'));
    expect(dropSpy).toHaveBeenCalledWith('proj-1', 'trust', expect.objectContaining({ profileId: 'eetv-5-layer-v2' }), expect.objectContaining({ profileId: 'eetv-5-layer-v2' }), 'run-101');
    h2.unmount();

    dropSpy.mockClear();
    const h3 = renderHook(() => useTrust([weakPage], 'https://example.com', run2, 'proj-1'));
    expect(dropSpy).not.toHaveBeenCalled();
    h3.unmount();
    const h4 = renderHook(() => useTrust([], 'https://example.com', null, null));
    expect(h4.result.current.report).toBeNull();
    h4.unmount();
  });

  it('covers internalLinkOpportunities with ordinary typed data and link exclusion', () => {
    const makePage = (url: string, overrides: Partial<CrawledPageSummary> = {}): CrawledPageSummary => ({
      url, final_url: url, http_status: 200, indexability_status: 'indexable',
      body_truncated: false, semantic_links: [], ...overrides,
    } as never);

    const pages = [
      makePage('https://example.com/p1'),
      makePage('https://example.com/p2'),
      makePage('https://example.com/p3', {
        semantic_links: [{ is_internal: true, target_url: 'https://example.com/p1', source_url: 'https://example.com/p3', anchor_text: 'link' }] as never,
      }),
      makePage('https://example.com/p4', { indexability_status: 'noindex' }),
    ];

    const report = findInternalLinkOpportunities(pages);
    expect(report.eligiblePageCount).toBe(3);
    expect(report.pagesWithoutCompleteEvidence).toBe(1);
    expect(report.opportunities.length).toBeGreaterThanOrEqual(1);

    const opp = report.opportunities[0];
    expect(opp.sourceUrl).toBeDefined();
    expect(opp.targetUrl).toBeDefined();
    expect(opp.sharedTerms.length).toBeGreaterThanOrEqual(2);
    expect(opp.weightedJaccard).toBeGreaterThan(0);
  });
});
