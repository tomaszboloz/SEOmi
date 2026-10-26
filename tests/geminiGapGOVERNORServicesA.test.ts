import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import i18n from '@/i18n';
import { useTrust } from '@/hooks/useTrust';
import { findInternalLinkOpportunities } from '@/services/internalLinkOpportunities';
import * as eeatTrust from '@/services/eeatTrust';
import * as monitoringAlerts from '@/services/monitoringAlerts';
import type { CrawledPageSummary } from '@/types';

vi.mock('@/services/monitoringAlerts', () => ({
  monitorScoreDrop: vi.fn(),
}));

vi.mock('@/services/siteFocus', () => ({
  buildSiteFocusReport: vi.fn().mockReturnValue({ topic: 'SEO' }),
}));

vi.mock('@/services/semanticText', () => ({
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
    const dummyPage = { url: 'https://example.com/p', final_url: 'https://example.com/p' } as CrawledPageSummary;
    const run = { id: 'run-100', completedAt: '2026-01-01T00:00:00Z' } as never;

    vi.spyOn(eeatTrust, 'readTrustHistory').mockReturnValue([]);
    vi.spyOn(eeatTrust, 'recordTrust').mockReturnValue([]);
    vi.spyOn(eeatTrust, 'buildTrustReport').mockReturnValue({ score: 75 } as never);
    const dropSpy = vi.spyOn(monitoringAlerts, 'monitorScoreDrop').mockRejectedValue(new Error('dispatch fail'));

    const h1 = renderHook(() => useTrust([dummyPage], 'https://example.com', run, 'proj-1'));
    expect(dropSpy).toHaveBeenCalledWith('proj-1', 'trust', undefined, expect.any(Object), 'run-100');
    h1.unmount();

    vi.spyOn(eeatTrust, 'readTrustHistory').mockReturnValue([{ runId: 'run-100', score: 80 } as never]);
    dropSpy.mockClear();
    const h2 = renderHook(() => useTrust([dummyPage], 'https://example.com', run, 'proj-1'));
    expect(dropSpy).not.toHaveBeenCalled();
    h2.unmount();

    const h3 = renderHook(() => useTrust([], 'https://example.com', null, null));
    expect(h3.result.current.report).toBeNull();
    h3.unmount();
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
