import { describe, expect, it, vi } from 'vitest';
import type { BacklinkGapOpportunity, CrawledPageSummary, GscSiteProperty } from '@/types';
import { buildSuggestionEvidence } from '@/services/freeSuggestions/suggestionEvidence';
import { joinGa4Evidence } from '@/services/ga4/join';
import { matchGscProperty } from '@/services/gscPropertyMatch';
import { findInternalLinkOpportunities } from '@/services/internalLinkOpportunities';
import { importAccessLog } from '@/services/logIntelligence/importer';
import { checkAlt } from '@/services/multimodal/altCheck';
import { outreachTargets } from '@/services/outreachCopilot/gap';
import { analyzeTarget } from '@/services/copilotPatcher/analyze';

const page = (url: string, patch: Partial<CrawledPageSummary> = {}): CrawledPageSummary => ({
  url, final_url: url, http_status: 200, title: 'Solar guide', semantic_terms: ['solar', 'panel'], semantic_links: [],
  indexability_status: 'indexable', body_truncated: false, redirect_chain: [], ...patch,
} as CrawledPageSummary);
const owned = (...siteUrls: string[]): GscSiteProperty[] => siteUrls.map((siteUrl) => ({ siteUrl, permissionLevel: 'siteOwner' }));
const row = (domain: string): BacklinkGapOpportunity => ({ referring_domain: domain, target_backlinks: 0, max_competitor_spam_score: null, competitor_backlinks: [{ domain: 'rival.test', backlinks: 1, rank: 50 }] });
const logLine = (ip: string, bytes = '512'): string => `10.0.0.1 - - [10/Oct/2026:13:55:36 +0000] "GET /bot HTTP/1.1" 200 ${bytes} "-" "Googlebot/2.1"` .replace('10.0.0.1', ip);

describe('coverage 100 service edges', () => {
  it('keeps the URL-prefix property strict and joins validated GA4 evidence', () => {
    expect(matchGscProperty(owned('https://site.test/'), 'https://site.test')).toBe('https://site.test/');
    expect(matchGscProperty(owned('https://site.test:8443/'), 'https://site.test:8443')).toBe('https://site.test:8443/');
    const result = joinGa4Evidence({
      projectRootUrl: 'https://site.test/',
      report: { property: 'properties/1', start_date: '2026-01-01', end_date: '2026-01-31', rows: [{ host_name: 'site.test', landing_page: '/', sessions: 1, engaged_sessions: 1, key_events: 0 }], row_count: 1, may_be_truncated: false },
      gscData: { site_url: 'https://site.test/', start_date: '2026-01-01', end_date: '2026-01-31', total_clicks: 1, total_impressions: 2, avg_ctr: 0.5, avg_position: 1, pages: [{ page: 'https://site.test/', clicks: 1, impressions: 2, ctr: 0.5, position: 1 }], queries: [], daily: [], daily_may_be_truncated: false, queries_may_be_truncated: false, pages_may_be_truncated: false, max_rows_per_dimension: 100 },
    });
    expect(result.matched_gsc_rows).toBe(1);
  });

  it('uses the weighted-Jaccard zero fallback when the weight source is empty', () => {
    const log = vi.spyOn(Math, 'log').mockReturnValue(0);
    const result = findInternalLinkOpportunities([page('https://example.test/a'), page('https://example.test/b')]);
    expect(result.opportunities).toEqual([]);
    log.mockRestore();
  });

  it('falls back to stored page count when the crawl omits pages_crawled', () => {
    const run = { id: 'r', projectId: 'p', completedAt: '2026-01-01', result: { pages: [page('https://example.test/a')], pages_crawled: undefined } };
    const result = buildSuggestionEvidence({ suggestions: ['solar'], activeProjectId: 'p', runs: [run] as never, language: 'en' });
    expect(result.pagesConsidered).toBe(1);
    expect(result.pagesOmitted).toBe(0);
    const counted = buildSuggestionEvidence({ suggestions: ['solar'], activeProjectId: 'p', runs: [{ ...run, result: { ...run.result, pages_crawled: 3 } }] as never, language: 'en' });
    expect(counted.pagesOmitted).toBe(2);
  });

  it('keeps a clean alt verdict and flags a disjoint context', () => {
    expect(checkAlt({ src: 'x.png', alt: 'Solar panel', context: 'Coffee brewing guide' })).toMatchObject({ role: 'unknown', issues: ['unrelated-to-context'], contextOverlap: 0 });
  });

  it('reaches the domain tie-breaker for equally ranked outreach targets', () => {
    const result = outreachTargets([row('z.example'), row('a.example')], 2);
    expect(result.map((target) => target.domain)).toEqual(['a.example', 'z.example']);
  });

  it('handles a missing word match and a null log byte count', async () => {
    expect(analyzeTarget({ h1: '', h2: [], heading: null, paragraph: '!!!', language: 'en', pageEntities: [], missingEntities: [], removeFragments: [] })).toEqual({ dangling: [], spoGaps: [], missing: [] });
    expect(analyzeTarget({ h1: '', h2: [], heading: null, paragraph: '#.', language: 'en', pageEntities: [], missingEntities: [], removeFragments: [] })).toEqual({ dangling: [], spoGaps: [], missing: [] });
    const state = await importAccessLog({ lines: [logLine('10.1.1.1', '-')], fileHash: 'null-bytes' });
    expect(Object.values(state.aggs)[0].bytes).toBe(0);
    const ignored = await importAccessLog({ lines: [logLine('10.1.1.2').replace(' 200 512 ', ' 600 512 ')], fileHash: 'unknown-status' });
    expect(ignored.ignoredNonBot).toBe(1);
  });

  it('clears the bounded bot cache while streaming unique addresses', async () => {
    const lines = Array.from({ length: 10001 }, (_, index) => logLine(`10.${Math.floor(index / 65536) % 256}.${Math.floor(index / 256) % 256}.${index % 256}`));
    const state = await importAccessLog({ lines, fileHash: 'cache-bound' });
    expect(state.lines).toBe(10001);
    expect(state.inProgress).toBeNull();
  });
});
