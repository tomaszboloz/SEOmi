import { describe, expect, it } from 'vitest';
import type { CrawledLink, GscSiteProperty, PageAuditData } from '@/types';
import { matchGscProperty } from '@/services/gscPropertyMatch';
import { crawlLinkStatus, filterAndSortCrawlLinks, type CrawlLinkFilters, type CrawlLinkRecord } from '@/services/crawlLinkFilters';
import { parseGoogleSuggestions } from '@/services/freeSuggestions/parser';
import { buildAiPrompt } from '@/services/ai/prompt';
import { parseWorkspaceHash } from '@/services/workspaceDeepLink';
import { parseSiteCrawlResult } from '@/services/crawlContracts';
import { createCrawlPageFixture, createCrawlResultFixture } from './fixtures/crawl';

const owned = (...siteUrls: string[]): GscSiteProperty[] => siteUrls.map((siteUrl) => ({ siteUrl, permissionLevel: 'siteOwner' }));

describe('gscPropertyMatch remaining branches', () => {
  it('ignores a domain property whose host is not a valid URL host', () => {
    expect(matchGscProperty(owned('sc-domain:exa mple.com'), 'https://example.com/')).toBeNull();
  });

  it('skips a prefix property that cannot be parsed as a URL', () => {
    expect(matchGscProperty(owned('not a url', 'https://example.com/'), 'https://example.com/page')).toBe('https://example.com/');
  });

  it('prefers the longest covering parent domain property', () => {
    expect(matchGscProperty(owned('sc-domain:example.com', 'sc-domain:a.example.com'), 'https://b.a.example.com/')).toBe('sc-domain:a.example.com');
  });
});

describe('crawlLinkFilters remaining branches', () => {
  const link = (patch: Partial<CrawledLink>): CrawledLink => ({ target_url: 'https://x.test/', anchor_text: 'a', is_internal: true, ...patch } as CrawledLink);
  const record = (key: string, patch: Partial<CrawledLink>): CrawlLinkRecord => ({ key, sourceUrl: `https://s.test/${key}`, link: link(patch) });
  const filters = (patch: Partial<CrawlLinkFilters>): CrawlLinkFilters => ({ query: '', kind: 'all', status: 'all', sort: 'source', descending: false, ...patch });

  it('treats the legacy error filter as broken links only', () => {
    const records = [record('a', { target_http_status: 404 }), record('b', { target_http_status: 200 })];
    expect(filterAndSortCrawlLinks(records, filters({ status: 'error' })).map((r) => r.key)).toEqual(['a']);
    expect(crawlLinkStatus(records[0].link)).toBe('broken');
  });

  it('sorts by status when targets have no HTTP status', () => {
    const records = [record('a', { target_http_status: 404 }), record('b', {}), record('c', {})];
    const sorted = filterAndSortCrawlLinks(records, filters({ sort: 'status' })).map((r) => r.key);
    expect(sorted).toEqual(['a', 'b', 'c']);
    expect(filterAndSortCrawlLinks(records, filters({ sort: 'status', descending: true })).map((r) => r.key)[2]).toBe('a');
  });
});

describe('freeSuggestions parser remaining branches', () => {
  const request = { feed: 'google-suggestions' as const, geo: 'PL', keyword: 'seo', language: 'en' };

  it('rejects an invalid fetch timestamp', () => {
    expect(() => parseGoogleSuggestions(JSON.stringify(['seo', ['seo a']]), request, undefined, 'not-a-date')).toThrow(/timestamp/);
  });

  it('rejects an unparseable JSON payload', () => {
    expect(() => parseGoogleSuggestions('[not json', request)).toThrow();
  });

  it('drops blank suggestions', () => {
    const result = parseGoogleSuggestions(JSON.stringify(['seo', ['  ', 'seo audit']]), request);
    expect(result.suggestions).toEqual(['seo audit']);
  });
});

describe('buildAiPrompt', () => {
  it('marks missing metadata and headings', () => {
    const audit = {
      url: 'https://x.test/', final_url: 'https://x.test/',
      meta_tags: { title: '', description: '' }, headings: { h1_texts: [] },
      content_stats: { top_keywords: [] },
    } as unknown as PageAuditData;
    expect(buildAiPrompt(audit)).toContain('(missing)');
  });
});

describe('parseWorkspaceHash', () => {
  it('rejects a hash without a project', () => {
    expect(parseWorkspaceHash('#workspace?tab=links')).toBeNull();
  });
});

describe('crawl summary contract', () => {
  it('maps null frames to undefined', () => {
    const page = { ...createCrawlPageFixture({ url: 'https://example.test/' }), frames: null, frames_truncated: null, favicons: null };
    const parsed = parseSiteCrawlResult(createCrawlResultFixture({ pages: [page as never] }));
    expect(parsed?.pages[0].frames).toBeUndefined();
    expect(parsed?.pages[0].favicons).toBeUndefined();
  });
});
