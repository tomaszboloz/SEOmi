import { describe, expect, it } from 'vitest';
import { crawlCustomSearchCsv, crawlFramesCsv, crawlImagesCsv, crawlIssuesCsv, crawlLinksCsv, crawlPagesCsv, crawlResourcesCsv } from '@/services/export';
import { CrawlRunRecord } from '@/types';
import { crawlRun } from './fixtures/export';

describe('export contracts: context', () => {
  it('keeps scope, timestamp and configuration when a saved run has no rows', () => {
      const emptyRun = {
        ...crawlRun,
        result: { ...crawlRun.result, pages: [], pages_crawled: 0, resources: [] },
        config: { ...crawlRun.config, customSearches: [{ id: 'search-1', name: 'Title', selectorType: 'css', query: 'title', resultType: 'text' }] },
      } as CrawlRunRecord;
      const exports = [
        crawlPagesCsv(emptyRun), crawlLinksCsv(emptyRun), crawlImagesCsv(emptyRun),
        crawlCustomSearchCsv(emptyRun), crawlResourcesCsv(emptyRun), crawlFramesCsv(emptyRun), crawlIssuesCsv(emptyRun),
      ];
      for (const output of exports) {
        expect(output).toContain('run-unsafe');
        expect(output).toContain('2026-09-21T09:00:00.000Z');
        expect(output).toContain('https://example.com/');
        expect(output).toContain('includePatterns');
      }
      expect(crawlCustomSearchCsv(emptyRun)).toContain('Crawl configuration');
    });

  it('includes run context and neutralizes formulas in every flattened table', () => {
      expect(crawlPagesCsv(crawlRun)).toContain("'=page");
      expect(crawlPagesCsv(crawlRun)).toContain("'+final");
      expect(crawlLinksCsv(crawlRun)).toContain("'-link");
      expect(crawlLinksCsv(crawlRun)).toContain("'=anchor");
      expect(crawlImagesCsv(crawlRun)).toContain("'@image");
      expect(crawlImagesCsv(crawlRun)).toContain("'+alt");
      expect(crawlIssuesCsv(crawlRun)).toContain("'=issue");
      expect(crawlPagesCsv(crawlRun)).toContain('Scope start URL');
      expect(crawlPagesCsv(crawlRun)).toContain('Rendered LCP ms');
      expect(crawlPagesCsv(crawlRun)).toContain('Discovery sources');
      expect(crawlPagesCsv(crawlRun)).toContain('2026-09-21T09:00:00.000Z');
    });

  it('exports recorded discovery sources with each crawled URL', () => {
      const run = {
        ...crawlRun,
        result: {
          ...crawlRun.result,
          pages: crawlRun.result.pages.map((page) => ({
            ...page,
            discovery_sources: [
              { kind: 'link', source_url: 'https://example.com/parent', anchor_text: 'Guide' },
              { kind: 'sitemap', source_url: 'https://example.com/sitemap.xml' },
            ],
          })),
          discovery_provenance_truncated: true,
        },
      } as CrawlRunRecord;
  
      const output = crawlPagesCsv(run);
      expect(output).toContain('link: https://example.com/parent: Guide | sitemap: https://example.com/sitemap.xml');
      expect(output).toContain('Discovery provenance truncated');
      expect(output).toContain('"yes"');
    });

  it('exports canonical declarations, classifications, verification scope and robots conflicts', () => {
      const canonicalRun = {
        ...crawlRun,
        result: {
          ...crawlRun.result,
          pages: crawlRun.result.pages.map((page) => ({
            ...page,
            canonical: 'https://example.com/canonical',
            canonical_relation: 'same-host-other-url',
            canonical_declaration_count: 1,
            canonical_robots_conflict: true,
            indexability_verdict: { status: 'uncertain', reasons: ['canonical_points_elsewhere', 'robots_nofollow'] },
            canonical_targets: [
              { url: 'https://example.com/canonical', relation: 'same-host-other-url', http_status: 404, checked_in_run: true },
              { url: 'https://example.com/not-crawled', relation: 'same-host-other-url', http_status: null, checked_in_run: false },
            ],
          })),
        },
      } as CrawlRunRecord;
      const output = crawlPagesCsv(canonicalRun);
  
      expect(output).toContain('Canonical relation');
      expect(output).toContain('Canonical declaration count');
      expect(output).toContain('Canonical targets/status in run');
      expect(output).toContain('Canonical/noindex conflict');
      expect(output).toContain('Indexability verdict');
      expect(output).toContain('canonical_points_elsewhere | robots_nofollow');
      expect(output).toContain('same-host-other-url');
      expect(output).toContain('HTTP 404');
      expect(output).toContain('not checked in this run');
      expect(output).toContain('"yes"');
    });
});
