import { describe, expect, it } from 'vitest';
import type { CrawledLink } from '@/types';
import { buildTrustReport } from '@/services/eeatTrust/build';
import { summarizeTrust } from '@/services/eeatTrust/summary';
import { analyzeCitations, citationScore, citationsUnverified, isDeadLink, isTrustedHost, UNVERIFIED_CITATION_CAP } from '@/services/eeatTrust/citations';
import { detectYmyl } from '@/services/eeatTrust/ymyl';
import { createCrawlPageFixture } from './fixtures/crawl';

const link = (target: string, status?: number, error?: string): CrawledLink => ({
  target_url: target, anchor_text: 'ref', is_internal: false, target_http_status: status, target_request_error_kind: error,
});

describe('geminiAITrust05 - uncertain citation evidence, reachability vs declaration, and bounds', () => {
  describe('declared schema citations vs checked crawl links via buildTrustReport producer', () => {
    it('caps score at UNVERIFIED_CITATION_CAP and does not set sourceChecked when declared without crawl check', () => {
      const page = createCrawlPageFixture({
        url: 'https://site.test/article-1', final_url: 'https://site.test/article-1',
        schema_references: [
          { format: 'JSON-LD', declaration_index: 0, property: '@type', value: 'Article' },
          { format: 'JSON-LD', declaration_index: 0, property: 'citation', value: 'https://doi.org/10.1000/182' },
        ],
      });
      const report = buildTrustReport([page]);

      expect(report.citations.pagesWithTrusted).toBe(1);
      expect(report.citations.checkedLinks).toBe(0);
      expect(citationsUnverified(report.citations)).toBe(true);
      expect(report.layers.citationQuality).toBe(UNVERIFIED_CITATION_CAP);
      expect(report.citations).not.toHaveProperty('sourceChecked');
    });

    it('removes unverified cap when outbound links are checked 200 OK without fabricating claim verification', () => {
      const page = createCrawlPageFixture({
        url: 'https://site.test/article-1', final_url: 'https://site.test/article-1',
        links: [link('https://doi.org/10.1000/182', 200)],
        schema_references: [{ format: 'JSON-LD', declaration_index: 0, property: '@type', value: 'Article' }],
      });
      const report = buildTrustReport([page]);

      expect(report.citations.checkedLinks).toBe(1);
      expect(citationsUnverified(report.citations)).toBe(false);
      expect(report.layers.citationQuality).toBe(100);
      expect(report).not.toHaveProperty('claimVerified');
    });

    it('penalizes score when gov/trusted hosts are dead; gov status does not exempt dead links', () => {
      const deadGov = link('https://cdc.gov/outage', 404);
      const networkErr = link('https://who.int/down', undefined, 'ECONNREFUSED');
      expect(isDeadLink(deadGov)).toBe(true);
      expect(isDeadLink(networkErr)).toBe(true);

      const page = createCrawlPageFixture({
        url: 'https://site.test/art-1', final_url: 'https://site.test/art-1',
        links: [link('https://who.int/live', 200), deadGov],
        schema_references: [{ format: 'JSON-LD', declaration_index: 0, property: '@type', value: 'Article' }],
      });
      const report = buildTrustReport([page]);
      expect(report.citations.checkedLinks).toBe(2);
      expect(report.citations.deadLinks).toHaveLength(1);
      expect(report.layers.citationQuality).toBe(75);
    });
  });

  describe('cross-page and in-page scholarly source deduplication', () => {
    it('deduplicates variant DOI URLs across multiple pages to one unique scholarly source in buildTrustReport', () => {
      const p1 = createCrawlPageFixture({
        url: 'https://site.test/art-1', final_url: 'https://site.test/art-1',
        links: [link('https://doi.org/10.1000/shared', 200)],
        schema_references: [{ format: 'JSON-LD', declaration_index: 0, property: '@type', value: 'Article' }],
      });
      const p2 = createCrawlPageFixture({
        url: 'https://site.test/art-2', final_url: 'https://site.test/art-2',
        links: [link('https://dx.doi.org/10.1000%2Fshared.', 200)],
        schema_references: [{ format: 'JSON-LD', declaration_index: 0, property: '@type', value: 'Article' }],
      });
      const report = buildTrustReport([p1, p2]);

      expect(report.citations.pagesAnalyzed).toBe(2);
      expect(report.citations.pagesWithScholarly).toBe(2);
      expect(report.citations.scholarlySources).toBe(1);
    });

    it('deduplicates repeated identical citations on the same page', () => {
      const page = createCrawlPageFixture({
        url: 'https://site.test/art-1', final_url: 'https://site.test/art-1',
        links: [link('https://doi.org/10.1000/182', 200), link('https://doi.org/10.1000/182', 200)],
      });
      const detail = analyzeCitations([page], new Set([page.url]), new Map());
      expect(detail.trustedLinks).toBe(1);
      expect(detail.scholarlySources).toBe(1);
    });
  });

  describe('trusted host verification, look-alike domain rejection, and unsafe URLs', () => {
    it('recognizes authentic seed domains and rejects look-alikes attempting spoofing', () => {
      expect(isTrustedHost('who.int')).toBe(true);
      expect(isTrustedHost('cdc.gov')).toBe(true);
      expect(isTrustedHost('who.int.attacker.com')).toBe(false);
      expect(isTrustedHost('evil-cdc.gov.phishing.org')).toBe(false);
      expect(isTrustedHost('')).toBe(false);
    });

    it('handles unsafe schemes gracefully without counting as trusted', () => {
      const page = createCrawlPageFixture({
        url: 'https://site.test/art-unsafe', final_url: 'https://site.test/art-unsafe',
        links: [link('javascript:alert(1)'), link('data:text/html,payload')],
      });
      const detail = analyzeCitations([page], new Set([page.url]), new Map());
      expect(detail.pagesWithTrusted).toBe(0);
      expect(detail.pagesWithScholarly).toBe(0);
    });
  });

  describe('missing data, undefined vs null DTO representations', () => {
    it('leaves citationQuality undefined in report and null in PDF summary when no articles exist', () => {
      const nonArticle = createCrawlPageFixture({ url: 'https://site.test/about', final_url: 'https://site.test/about' });
      const report = buildTrustReport([nonArticle]);

      expect(report.articleCount).toBe(0);
      expect(report.citations.pagesAnalyzed).toBe(0);
      expect(citationScore(report.citations)).toBeUndefined();
      expect(report.layers.citationQuality).toBeUndefined();
      expect(report.ymyl).toBeUndefined();

      const summary = summarizeTrust(report);
      expect(summary.layers.citation_quality).toBeNull();
      expect(summary.ymyl).toBeNull();
      expect(summary.ymyl_unattributed_pct).toBeNull();
    });

    it('returns undefined for YMYL category when signals are ambiguous or below threshold', () => {
      expect(detectYmyl([], undefined, ['Random Unrelated Title'])).toBeUndefined();
    });
  });
});
