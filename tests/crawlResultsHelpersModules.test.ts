import { describe, expect, it } from 'vitest';
import {
  tabs,
  tabGroups,
  tabGroupForTab,
} from '@/components/Domain/crawlResults/helpers/crawlResultsTabsConfig';
import {
  metadataFacetOptions,
  metadataFacetIds,
  metadataFacetsForPage,
} from '@/components/Domain/crawlResults/helpers/crawlResultsMetadata';
import {
  emptyCrawlNavigationPreferences,
  readCrawlNavigationPreferences,
  emptyCrawlLinkNavigationPreferences,
  readCrawlLinkNavigationPreferences,
  filterPresetsKey,
  loadFilterPresets,
} from '@/components/Domain/crawlResults/helpers/crawlResultsPreferences';
import {
  formatNumber,
  normalizeLinkUrl,
  optional,
  discoverySourcesForPage,
} from '@/components/Domain/crawlResults/helpers/crawlResultsFormatters';
import type { CrawledPageSummary } from '@/types';
import { codeFiles, maxLocReport } from '../scripts/check-max-loc.mjs';

describe('crawlResultsHelpers modular architecture', () => {
  it('satisfies physical LOC <= 150 across crawlResultsHelpers and all helper submodules', () => {
    const files = [
      'src/components/Domain/crawlResults/crawlResultsHelpers.ts',
      ...codeFiles('src/components/Domain/crawlResults/helpers'),
    ];
    expect(files.length).toBeGreaterThanOrEqual(4);
    const report = maxLocReport(files);
    expect(report.violations).toEqual([]);
  });

  it('maps tabs to correct tab groups', () => {
    expect(tabs.length).toBeGreaterThanOrEqual(15);
    expect(tabGroups.length).toBe(4);
    expect(tabGroupForTab('overview')).toBe('core');
    expect(tabGroupForTab('content')).toBe('content');
    expect(tabGroupForTab('directives')).toBe('technical');
    expect(tabGroupForTab('exports')).toBe('export');
  });

  it('correctly classifies metadata facets for pages', () => {
    expect(metadataFacetOptions.length).toBe(9);
    expect(metadataFacetIds.has('missing-title')).toBe(true);

    const nonHtmlPage = {
      url: 'https://example.com/doc.pdf',
      final_url: 'https://example.com/doc.pdf',
      redirect_chain: [],
      http_status: 200,
      depth: 1,
      issues: [],
      issues_count: 0,
      content_type: 'application/pdf',
      response_time_ms: 50,
      indexability_status: 'non-indexable',
      body_truncated: false,
      word_count: 0,
      schema_types: [],
      schema_syntax_errors: 0,
      hreflangs: [],
      h1_count: 0,
      internal_link_count: 0,
      external_link_count: 0,
      links: [],
      images: [],
    } as CrawledPageSummary;
    expect(metadataFacetsForPage(nonHtmlPage)).toEqual([]);

    const htmlPageWithoutTitle = {
      url: 'https://example.com',
      final_url: 'https://example.com',
      redirect_chain: [],
      http_status: 200,
      depth: 0,
      issues: [],
      issues_count: 0,
      content_type: 'text/html',
      response_time_ms: 120,
      indexability_status: 'indexable',
      body_truncated: false,
      word_count: 50,
      schema_types: [],
      schema_syntax_errors: 0,
      hreflangs: [],
      h1_count: 0,
      internal_link_count: 0,
      external_link_count: 0,
      links: [],
      images: [],
    } as CrawledPageSummary;
    const facets = metadataFacetsForPage(htmlPageWithoutTitle);
    expect(facets).toContain('missing-title');
    expect(facets).toContain('missing-description');
  });

  it('handles empty and malformed navigation preferences', () => {
    expect(emptyCrawlNavigationPreferences().activeTab).toBe('overview');
    expect(readCrawlNavigationPreferences(null).activeTab).toBe('overview');
    expect(readCrawlNavigationPreferences('nonexistent_key_12345').activeTab).toBe('overview');

    expect(emptyCrawlLinkNavigationPreferences().sort).toBe('source');
    expect(readCrawlLinkNavigationPreferences(null).sort).toBe('source');
  });

  it('formats numbers and normalizes URLs cleanly', () => {
    expect(formatNumber(1234.56)).toBe('1,235');
    expect(normalizeLinkUrl('https://example.com/page#section')).toBe('https://example.com/page');
    expect(optional(null)).toBe('—');
    expect(optional('')).toBe('—');
    expect(optional('hello')).toBe('hello');
    expect(discoverySourcesForPage({} as CrawledPageSummary)).toEqual([]);
  });

  it('returns empty array when filter preset storage key is not set', () => {
    expect(filterPresetsKey('proj1')).toBe('seomi_project_proj1_crawl_filter_presets_v1');
    expect(loadFilterPresets('nonexistent_proj')).toEqual([]);
  });
});
